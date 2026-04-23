# Generated migration for adding gender and province fields to Citizen model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('citizens', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='citizen',
            name='gender',
            field=models.CharField(
                blank=True,
                choices=[
                    ('MALE', 'Male'),
                    ('FEMALE', 'Female'),
                    ('OTHER', 'Other'),
                ],
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='citizen',
            name='province',
            field=models.CharField(
                blank=True,
                choices=[
                    ('CENTRAL', 'Central'),
                    ('COPPERBELT', 'Copperbelt'),
                    ('EASTERN', 'Eastern'),
                    ('LUAPULA', 'Luapula'),
                    ('LUSAKA', 'Lusaka'),
                    ('MUCHINGA', 'Muchinga'),
                    ('NORTHERN', 'Northern'),
                    ('NORTHWEST', 'North-Western'),
                    ('SOUTHERN', 'Southern'),
                    ('WESTERN', 'Western'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name='citizen',
            index=models.Index(fields=['gender'], name='citizen_gender_idx'),
        ),
        migrations.AddIndex(
            model_name='citizen',
            index=models.Index(fields=['province'], name='citizen_province_idx'),
        ),
    ]
