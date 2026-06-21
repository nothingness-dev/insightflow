from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.surveys.urls')),
    path('api/', include('apps.activity.urls')),
]

# FIX #1: debug_ip endpoint removed — it was exposed unconditionally in production,
# leaking internal IP / header information to any caller who knew the URL.
# FIX #11: static/media are served by nginx in production; only mount them in
# DEBUG mode (local dev without nginx) so runserver works out of the box.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
