import re
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.environment import Environment
from app.models.member import ProjectMember
from app.strategies.access import get_access_strategy


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a project name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug[:50] or 'project'


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_project(
        self,
        owner_id: UUID,
        name: str,
        slug: Optional[str] = None,
        description: Optional[str] = None,
        encryption_key_id: Optional[str] = None,
        settings: Optional[dict] = None
    ) -> Project:
        if not slug:
            slug = _generate_slug(name)
            # Ensure uniqueness
            base_slug = slug
            counter = 1
            while True:
                existing = await self.db.execute(
                    select(Project).where(Project.slug == slug)
                )
                if not existing.scalar_one_or_none():
                    break
                slug = f"{base_slug}-{counter}"
                counter += 1
        else:
            existing = await self.db.execute(
                select(Project).where(Project.slug == slug)
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Project with slug '{slug}' already exists")

        project = Project(
            id=uuid4(),
            owner_id=owner_id,
            name=name,
            slug=slug,
            description=description,
            encryption_key_id=encryption_key_id,
            settings=settings or {},
            archived=False
        )
        self.db.add(project)
        await self.db.flush()

        member = ProjectMember(
            id=uuid4(),
            project_id=project.id,
            user_id=owner_id,
            role="owner",
            invited_by=owner_id
        )
        self.db.add(member)

        default_env = Environment(
            id=uuid4(),
            project_id=project.id,
            name="production",
            display_name="Production",
            is_default=True,
            secrets_version=0
        )
        self.db.add(default_env)

        staging_env = Environment(
            id=uuid4(),
            project_id=project.id,
            name="staging",
            display_name="Staging",
            is_default=False,
            secrets_version=0
        )
        self.db.add(staging_env)

        dev_env = Environment(
            id=uuid4(),
            project_id=project.id,
            name="development",
            display_name="Development",
            is_default=False,
            secrets_version=0
        )
        self.db.add(dev_env)

        await self.db.flush()

        return project

    async def get_project(self, project_id: UUID) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        return result.scalar_one_or_none()

    async def get_project_by_slug(self, slug: str) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.slug == slug)
        )
        return result.scalar_one_or_none()

    async def list_user_projects(
        self,
        user_id: UUID,
        include_archived: bool = False
    ) -> list[Project]:
        query = (
            select(Project)
            .join(ProjectMember, ProjectMember.project_id == Project.id)
            .where(ProjectMember.user_id == user_id)
        )

        if not include_archived:
            query = query.where(Project.archived == False)

        query = query.order_by(Project.updated_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_project(
        self,
        project_id: UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        settings: Optional[dict] = None,
        archived: Optional[bool] = None
    ) -> Optional[Project]:
        project = await self.get_project(project_id)
        if not project:
            return None

        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        if settings is not None:
            project.settings = settings
        if archived is not None:
            project.archived = archived

        await self.db.flush()
        await self.db.refresh(project)
        return project

    async def delete_project(self, project_id: UUID) -> bool:
        project = await self.get_project(project_id)
        if not project:
            return False

        await self.db.delete(project)
        return True

    async def check_user_access(
        self,
        user_id: UUID,
        project_id: UUID,
        required_role: Optional[str] = None
    ) -> Optional[ProjectMember]:
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.user_id == user_id,
                ProjectMember.project_id == project_id
            )
        )
        member = result.scalar_one_or_none()

        if not member:
            return None

        access_strategy = get_access_strategy(required_role)
        if not access_strategy.can_access(member.role):
            return None

        return member

    async def get_project_member_count(self, project_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(ProjectMember.id))
            .where(ProjectMember.project_id == project_id)
        )
        return result.scalar() or 0
