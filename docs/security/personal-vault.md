# Cofre pessoal: modelo criptográfico

O cofre pessoal guarda itens de um usuário que ficam fora dos projetos e ambientes, como logins de redes sociais e notas seguras. Ele segue o mesmo princípio do resto do CriptEnv: **tudo é cifrado no navegador e o servidor só guarda envelopes que não consegue ler**. Ao contrário dos secrets de projeto, o cofre pessoal **só existe no dashboard web**. A CLI não tem comando para ele, e a API recusa qualquer credencial que não seja o cookie de sessão do dashboard.

Código: `apps/web/src/lib/personal-vault/crypto.ts` (cliente) e `apps/api/app/routers/personal_vault.py` (API).

## Chaves

| Chave | O que é | Onde vive |
|---|---|---|
| **VK** (chave do cofre) | 32 bytes aleatórios, AES-256-GCM | `CryptoKey` não extraível, na memória, só enquanto o cofre está aberto |
| **PK** (chave de proteção extra) | 32 bytes aleatórios, AES-256-GCM | `CryptoKey` não extraível, só durante o "revelar" ou a edição de um item protegido |
| **Chave de recuperação** | 32 bytes aleatórios, em Crockford base32 (13 grupos de 4) | impressa pelo usuário; o servidor nunca a vê |

```
senha mestra ──PBKDF2-SHA256 600k──▶ KEK_mestra ──embrulha──▶ VK
chave de recuperação ──HKDF-SHA256──▶ KEK_rec ───embrulha──▶ VK  e  PK
senha extra ───PBKDF2-SHA256 600k──▶ KEK_extra ──embrulha──▶ PK ──o resultado é cifrado de novo com VK
```

- **Resumo de todo item** (`type`, `title`, `username`, `url`): cifrado com VK. É o que a lista mostra com o cofre aberto.
- **Corpo** (`password` e `notes`, ou `content`): cifrado com VK nos itens comuns e com **PK** nos itens com proteção extra.
- **Para abrir PK é preciso VK e a senha extra.** O envelope de PK por KEK_extra é cifrado de novo com VK, então nenhuma das duas senhas sozinha basta.
- **Senha errada aparece como falha de autenticação do AES-GCM** ao desembrulhar. Não guardamos nenhum verificador.
- **Trocar uma senha só embrulha uma chave de novo.** Os itens não são cifrados outra vez. Por isso a config tem um único `iterations`, e trocar o KDF exige selar o cofre inteiro de novo.
- **Usar a recuperação** redefine as duas senhas e **gera uma nova chave de recuperação**. A antiga deixa de valer.

## O que o servidor vê

- Por usuário: `kdf`, `iterations`, os dois salts e os quatro envelopes de chave (`master_wrapped_vault_key`, `recovery_wrapped_vault_key`, `extra_wrapped_protected_key`, `recovery_wrapped_protected_key`) e uma `version`.
- Por item: os envelopes `summary` e `body` (`{iv, ciphertext, auth_tag}`), a flag `protected`, a `version` e as datas.
- Ele também consegue inferir a quantidade de itens e o tamanho aproximado de cada um.

O servidor **não vê** senhas, a chave de recuperação, títulos, usuários, URLs, senhas guardadas, notas ou conteúdo.

## O que o servidor garante

- **Só cookie.** `get_current_web_user` responde 403 a qualquer request com header `Authorization` (sessões da CLI, API keys `cek_`, tokens de CI) e só aceita o cookie httpOnly `session_token`.
- **Isolamento.** Todo acesso é filtrado pelo usuário da sessão. Um item de outro usuário responde 404.
- **Concorrência otimista.** Todo PUT leva `expected_version`, e o UPDATE é condicional. Uma aba com versão velha recebe 409 e recarrega, sem sobrescrever.
- **Limites.** KDF fixo `PBKDF2-SHA256` com 600.000 a 10.000.000 iterações; `iv` com 16 e `auth_tag` com 24 caracteres; resumo e chaves até 4.096 caracteres; corpo até 65.536; até 1000 itens por usuário.
- **Apagar a conta apaga o cofre** (`AuthService.delete_account`).

## No navegador

- **Senha mestra a cada acesso.** A VK fica só no estado de um provider React da rota `/vault`. Ela não vai para store, `localStorage` nem cache, e sair da rota a descarta.
- **Trava por inatividade.** O cofre tranca sozinho após 10 minutos sem interação. Ao trancar, os componentes com dados decifrados são desmontados.
- **Senha extra a cada "revelar".** A PK não é guardada entre aberturas.
- **Nada é gravado antes da confirmação.** Na criação, as chaves são geradas localmente e só são gravadas depois que o usuário confirma "Guardei a chave de recuperação".

## Riscos conhecidos

- **Sessão web roubada: ataque offline.** Quem roubar uma sessão web pode baixar os envelopes e tentar adivinhar as senhas offline. As 600 mil iterações e o mínimo de 12 caracteres para a senha mestra (8 para a extra) reduzem esse risco.
- **Sessão web roubada: substituição da config.** Quem roubar uma sessão web também pode **substituir a config** com `PUT /api/v1/personal-vault/config`. Ele não lê nada, mas deixa o dono sem acesso aos próprios dados, ou seja, é negação de serviço. Pedir reautenticação ou mandar e-mail de aviso na troca da config fica para depois.
- **Limite de itens.** É checado com count + insert. Duas criações simultâneas podem passar de 1000 por um item.
- **Cache em memória.** O cliente HTTP guarda as respostas GET (cifradas) por até 15 segundos.

## Alternativas descartadas

- **Pedir a senha mestra de novo** (o "re-prompt" do Bitwarden) como segunda camada. É proteção só de interface: com o cofre aberto, o dado já estaria decifrado na memória.
- **Passkey/WebAuthn PRF.** É a mais forte, mas o suporte dos navegadores ainda é irregular. Pode entrar depois como mais um embrulho da PK, sem mexer nos itens.
