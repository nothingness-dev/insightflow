from django.core.management.base import BaseCommand
from django.conf import settings
from decouple import config


class Command(BaseCommand):
    help = 'ایجاد حساب مدیر اولیه در صورت عدم وجود'

    def handle(self, *args, **kwargs):
        from apps.accounts.models import User

        admin_username = config('ADMIN_USERNAME', default='admin')
        admin_password = config('ADMIN_PASSWORD', default='admin12345')
        admin_full_name = config('ADMIN_FULL_NAME', default='مدیر سیستم')

        if not User.objects.filter(username=admin_username).exists():
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
