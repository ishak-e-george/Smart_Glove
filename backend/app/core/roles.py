class Role:
    ADMIN = "admin"
    RESEARCHER = "researcher"
    USER = "user"

# Role hierarchy or groups can be defined here if needed
ROLE_HIERARCHY = {
    Role.ADMIN: [Role.ADMIN, Role.RESEARCHER, Role.USER],
    Role.RESEARCHER: [Role.RESEARCHER, Role.USER],
    Role.USER: [Role.USER],
}

def is_privileged(user) -> bool:
    """Check if user is Admin or Researcher."""
    return user.role in [Role.ADMIN, Role.RESEARCHER]

def has_access(user, owner_id: int) -> bool:
    """Check if user is Admin, Researcher, or the Owner."""
    return is_privileged(user) or user.id == owner_id
