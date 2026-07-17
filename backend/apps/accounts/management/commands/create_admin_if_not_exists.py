from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from decouple import config


class Command(BaseCommand):
    help = 'ایجاد حساب مدیر اولیه در صورت عدم وجود'

    def handle(self, *args, **kwargs):
        from apps.accounts.models import User

        admin_username = config('ADMIN_USERNAME', default='admin')
        admin_password = config('ADMIN_PASSWORD', default='')
        admin_full_name = config('ADMIN_FULL_NAME', default='مدیر سیستم')

        if not User.objects.filter(username=admin_username).exists():
            if not admin_password:
                raise CommandError('ADMIN_PASSWORD must be set before creating the initial admin.')
            candidate = User(
                username=admin_username,
                full_name=admin_full_name,
                role='admin',
                is_staff=True,
                is_superuser=True,
            )
            try:
                validate_password(admin_password, user=candidate)
            except ValidationError as exc:
                raise CommandError(
                    'ADMIN_PASSWORD does not satisfy the configured password policy: '
                    + ' '.join(exc.messages)
                ) from exc
            User.objects.create_user(
                username=admin_username,
                password=admin_password,
                full_name=admin_full_name,
                role='admin',
                is_staff=True,
                is_superuser=True,
            )
            self.stdout.write(self.style.SUCCESS(f'حساب مدیر "{admin_username}" ایجاد شد.'))
        else:
            self.stdout.write(f'حساب مدیر "{admin_username}" از قبل موجود است.')
