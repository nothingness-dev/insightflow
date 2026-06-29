from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0009_survey_hash_link'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnonymousParticipation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip_address', models.GenericIPAddressField(verbose_name='آدرس IP')),
                ('anonymous_token', models.CharField(blank=True, max_length=64, verbose_name='توکن ناشناس')),
                ('user_agent', models.TextField(blank=True, verbose_name='مرورگر')),
                ('completed_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='زمان تکمیل')),
                ('hash_link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participations', to='surveys.surveyhashlink', verbose_name='لینک هش')),
                ('survey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='anonymous_participations', to='surveys.survey', verbose_name='نظرسنجی')),
            ],
            options={
                'verbose_name': 'مشارکت ناشناس',
                'verbose_name_plural': 'مشارکت‌های ناشناس',
                'ordering': ['-completed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='anonymousparticipation',
            index=models.Index(fields=['survey', 'ip_address'], name='anon_part_survey_ip_idx'),
        ),
        migrations.AddIndex(
            model_name='anonymousparticipation',
            index=models.Index(fields=['hash_link', 'ip_address'], name='anon_part_link_ip_idx'),
        ),
        migrations.AddConstraint(
            model_name='anonymousparticipation',
            constraint=models.UniqueConstraint(fields=('survey', 'hash_link', 'ip_address'), name='unique_anonymous_ip_per_link'),
        ),
    ]
