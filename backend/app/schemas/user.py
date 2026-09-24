from pydantic import BaseModel, EmailStr, Field, field_validator


PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def validate_password_strength(password: str) -> str:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
        )

    if len(password) > PASSWORD_MAX_LENGTH:
        raise ValueError(
            f"Password must be at most {PASSWORD_MAX_LENGTH} characters"
        )

    if not any(character.isalpha() for character in password):
        raise ValueError("Password must contain at least one letter")

    if not any(character.isdigit() for character in password):
        raise ValueError("Password must contain at least one number")

    return password


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        return validate_password_strength(password)

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        name = name.strip()

        if not name:
            raise ValueError("Name cannot be empty")

        return name


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    email_verified: bool


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=1)
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        return validate_password_strength(password)
