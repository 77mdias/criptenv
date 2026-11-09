# Cofre pessoal: modelo criptográfico

O cofre pessoal guarda itens de um usuário que ficam fora dos projetos e ambientes, como logins de redes sociais e notas seguras. Ele segue o mesmo princípio do resto do CriptEnv: **tudo é cifrado no navegador e o servidor só guarda envelopes que não consegue ler**. Ao contrário dos secrets de projeto, o cofre pessoal **só existe no dashboard web**. A CLI não tem comando para ele, e a API recusa qualquer credencial que não seja o cookie de sessão do dashboard.

Código: `apps/web/src/lib/personal-vault/crypto.ts` (cliente) e `apps/api/app/routers/personal_vault.py` (API).

## Chaves

| Chave | O que é | Onde vive |
|---|---|---|
| **VK** (chave do cofre) | chave AES-256-GCM gerada pelo WebCrypto | `CryptoKey` não extraível, na memória, só enquanto o cofre está aberto |
| **PK** (chave de proteção extra) | chave AES-256-GCM gerada pelo WebCrypto | `CryptoKey` não extraível, só durante o "revelar" ou a edição de um item protegido |
| **Chave de recuperação** | 32 bytes aleatórios, em Crockford base32 (13 grupos de 4) | impressa pelo usuário; o servidor nunca a vê |

```
senha mestra ──PBKDF2-SHA256 600k──▶ KEK_mestra ──embrulha──▶ VK
chave de recuperação ──HKDF-SHA256──▶ KEK_rec ───embrulha──▶ VK  e  PK
senha extra ───PBKDF2-SHA256 600k──▶ KEK_extra ──embrulha──▶ PK ──o resultado é cifrado de novo com VK
```

- **Resumo de todo item** (`type`, `title`, `username`, `url`): cifrado com VK. É o que a lista mostra com o cofre aberto.
- **Corpo** (`password` e `notes`, ou `content`): cifrado com VK nos itens comuns e com **PK** nos itens com proteção extra.
- **Para abrir PK é preciso VK e a senha extra.** O envelope de PK por KEK_extra é cifrado de novo com VK, então nenhuma das duas senhas sozinha basta.
- **VK e PK nunca viram bytes nem texto no JavaScript.** São embrulhadas e desembrulhadas com `crypto.subtle.wrapKey`/`unwrapKey`; as KEKs saem direto de `deriveKey` (PBKDF2/HKDF) com uso restrito a `wrapKey`/`unwrapKey`. Uma cópia extraível existe só dentro das funções que embrulham as chaves: na criação do cofre, na troca de senha e na recuperação.
- **Todo envelope leva associated data (AAD) do AES-GCM** no formato `criptenv:pv1:<contexto>`. Os campos da config levam o nome do campo. Os itens levam `item:<id>:summary` e `item:<id>:body:common|protected`, e o nome de cada pasta leva `folder:<id>:name`, sempre com o id gerado pelo cliente. Por isso o servidor não consegue trocar envelopes entre itens ou campos, nem inverter a marca `protected`, sem que a decifragem falhe. O corpo também não consegue sobrescrever `title`/`type`: o resultado é montado campo a campo.
- **Senha errada aparece como falha de autenticação do AES-GCM** ao desembrulhar. Não guardamos nenhum verificador.
- **Trocar uma senha só embrulha uma chave de novo.** Os itens não são cifrados outra vez. Por isso a config tem um único `iterations`, e trocar o KDF exige selar o cofre inteiro de novo.
- **Usar a recuperação** redefine as duas senhas e **gera uma nova chave de recuperação**. A antiga deixa de valer.

## O que o servidor vê

- Por usuário: `kdf`, `iterations`, os dois salts e os quatro envelopes de chave (`master_wrapped_vault_key`, `recovery_wrapped_vault_key`, `extra_wrapped_protected_key`, `recovery_wrapped_protected_key`) e uma `version`.
- Por item: os envelopes `summary` e `body` (`{iv, ciphertext, auth_tag}`), a flag `protected`, a `version` e as datas.
- Por pasta: o envelope do nome, a `version` e as datas.
- Ele também consegue inferir a quantidade de itens e de pastas e o tamanho aproximado de cada um.

O servidor **não vê** senhas, a chave de recuperação, títulos, usuários, URLs (com uma exceção: ver "Ícones de sites"), senhas guardadas, notas, conteúdo, nomes de pasta ou **quais itens estão em cada pasta**. A pasta de um item é o campo `folderId` dentro do resumo cifrado. A tabela de itens não tem coluna de pasta.

## O que o servidor garante

- **Só cookie.** `get_current_web_user` responde 403 a qualquer request com header `Authorization` (sessões da CLI, API keys `cek_`, tokens de CI) e só aceita o cookie httpOnly `session_token`.
- **Isolamento.** Todo acesso é filtrado pelo usuário da sessão. Um item de outro usuário responde 404.
- **Concorrência otimista.** Todo PUT leva `expected_version`, e o UPDATE é condicional. Uma aba com versão velha recebe 409 e recarrega, sem sobrescrever.
- **Limites de tamanho.** KDF fixo `PBKDF2-SHA256` com 600.000 a 10.000.000 iterações; `iv` com 16 e `auth_tag` com 24 caracteres; resumo e chaves até 4.096 caracteres; corpo até 65.536; nome de pasta até 1.024.
- **Limites por plano** (`apps/api/app/plans.py`). O plano gratuito permite 120 itens e 10 pastas; os planos `pro`, `max` e `unlimited` não têm limite no cofre. Quem não tem plano próprio (`users.plan` vazio) fica no `DEFAULT_PLAN` do servidor, que por padrão é `free`. Um valor desconhecido em `users.plan` vale como `free`. Passar do limite ao criar responde 402. Baixar um limite não apaga nada: quem já tem mais continua lendo, editando e apagando.
- **Apagar a conta apaga o cofre** (`AuthService.delete_account`).

## No navegador

- **Senha mestra a cada acesso.** A VK fica só no estado de um provider React da rota `/vault`. Ela não vai para store, `localStorage` nem cache, e sair da rota a descarta.
- **Trava por inatividade.** O cofre tranca sozinho após 10 minutos sem interação. Ao trancar, os componentes com dados decifrados são desmontados.
- **Senha extra a cada "revelar".** A PK não é guardada entre aberturas.
- **Mover de pasta não pede a senha extra.** "Mover para pasta" recifra só o resumo com a VK e reenvia o envelope do corpo como está. A AAD do corpo amarra o id e a marca `protected`, não a versão, então o corpo protegido continua válido e nunca é aberto. Apagar uma pasta só apaga a pasta: os itens que apontavam para ela aparecem em "Sem pasta".
- **Nada é gravado antes da confirmação.** Na criação, as chaves são geradas localmente e só são gravadas depois que o usuário confirma "Guardei a chave de recuperação".

## Ícones de sites

- **O que vaza.** Com a opção "Mostrar ícones de sites" ligada (o padrão), o navegador pede `GET /api/v1/icons/{domínio}/icon.png` para cada login com URL. O servidor vê o domínio (não a URL inteira, nem o usuário ou a senha), junto com o cookie de sessão, que o navegador manda sozinho.
- **O que o CriptEnv faz com isso.** Nada é guardado nem registrado: o domínio sai como `[oculto]` no log de acesso, no log de requisições, no log do `httpx` durante a busca, no Sentry e nos logs do Worker; os logs automáticos do Worker na Cloudflare (`invocation_logs`) estão desligados. Quem opera o servidor ainda poderia mudar o código e passar a registrar. A Cloudflare, que fica na frente de todo o tráfego, também vê o pedido.
- **Como não mandar nada.** Desligar "Mostrar ícones de sites" nas configurações do cofre. Vale para o navegador onde foi desligado (fica no `localStorage`). Desligada, o navegador não faz nenhum pedido de ícone.
- **No navegador.** Só pede ícone para `http(s)` com domínio público: IP, `localhost` e nomes como `.local`, `.lan`, `.internal`, `.home.arpa`, `.onion` e `.i2p` nunca saem do navegador.
- **Na busca (`app/services/site_icon_service.py`).** Só sessão web, só HTTPS na porta 443. O DNS é resolvido uma vez, IP interno ou privado é recusado e a conexão vai para o IP conferido (`app/services/outbound_target.py`, o mesmo do webhook). No máximo 2 redirecionamentos, cada um conferido de novo; 5 s por conexão e 10 s no total; página até 512 KB e imagem até 200 KB. Só sai PNG, ICO ou JPEG conferido pelos bytes, com `nosniff`. Cache em memória por 24 h, inclusive de "não achei".

## Riscos conhecidos

- **Sessão web roubada: ataque offline.** Quem roubar uma sessão web pode baixar os envelopes e tentar adivinhar as senhas offline. As 600 mil iterações e o mínimo de 12 caracteres para a senha mestra (8 para a extra) reduzem esse risco.
- **Sessão web roubada: substituição da config.** Quem roubar uma sessão web também pode **substituir a config** com `PUT /api/v1/personal-vault/config`. Ele não lê nada, mas deixa o dono sem acesso aos próprios dados, ou seja, é negação de serviço. Pedir reautenticação ou mandar e-mail de aviso na troca da config fica para depois.
- **Limites do plano.** São checados com count + insert. Duas criações simultâneas podem passar do limite por um item ou uma pasta.
- **Aba antiga durante o deploy das pastas.** Um web de antes das pastas não conhece `folderId`: editar um item numa aba aberta antes do deploy refaz o resumo sem a pasta, e o item volta para "Sem pasta". Não perde dado.
- **Cache em memória.** O cliente HTTP guarda as respostas GET (cifradas) por até 15 segundos.
- **Rollback não é detectado.** O servidor pode devolver uma versão antiga de um item (com a `version` antiga). A AAD amarra o envelope ao item, não à versão; detectar isso exigiria guardar estado no cliente.

## Alternativas descartadas

- **Pedir a senha mestra de novo** (o "re-prompt" do Bitwarden) como segunda camada. É proteção só de interface: com o cofre aberto, o dado já estaria decifrado na memória.
- **Passkey/WebAuthn PRF.** É a mais forte, mas o suporte dos navegadores ainda é irregular. Pode entrar depois como mais um embrulho da PK, sem mexer nos itens.
