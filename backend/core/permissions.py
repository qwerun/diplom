from rest_framework.permissions import SAFE_METHODS, BasePermission


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return "admin"
    return getattr(getattr(user, "profile", None), "role", None)


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) == "admin"


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        # Чтение справочников нужно всем авторизованным пользователям,
        # а изменение справочников оставляем только администратору.
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return user_role(request.user) == "admin"


class IsManagerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        role = user_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ["admin", "manager", "executor", "head"]
        return role in ["admin", "manager"]


class IsManagerOrStatusOnly(BasePermission):
    def has_permission(self, request, view):
        role = user_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ["admin", "manager", "executor", "head"]
        if role in ["admin", "manager"]:
            return True
        # Исполнитель не редактирует карточку целиком, но может двигать статус
        # по разрешенным переходам. Конкретный переход проверяет serializer.
        if request.method == "PATCH" and role == "executor":
            return set(request.data.keys()) <= {"status"}
        return False


class IsAdminOrHead(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) in ["admin", "head"]


class CanEditMetrics(BasePermission):
    def has_permission(self, request, view):
        role = user_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ["admin", "manager", "executor", "head"]
        return role in ["admin", "manager", "executor"]


class CanEditActivityResult(BasePermission):
    def has_permission(self, request, view):
        role = user_role(request.user)
        if request.method in SAFE_METHODS:
            return role in ["admin", "manager", "executor", "head"]
        return role in ["admin", "manager", "executor"]
