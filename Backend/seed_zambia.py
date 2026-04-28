import os
import django

# 1. Setup Django environment
# Based on your code, your project settings are in 'zdid_core'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zdid_core.settings')
django.setup()

# Replace 'citizens' with the actual name of the app where these models live
from citizens.models import Province, District


def seed_data():
    # Mapping of Provinces to their Districts
    # Province: (Code, [List of Districts])
    zambia_data = {
        "Central": ("CEN", ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Serenje", "Shibuyunji"]),
        "Copperbelt": ("CPB", ["Chililabombwe", "Chingola", "Kalulushi", "Kitwe", "Luanshya", "Lufwanyama", "Masaiti",
                               "Mpongwe", "Mufulira", "Ndola"]),
        "Eastern": ("EAS", ["Chadiza", "Chipata", "Katete", "Lundazi", "Nyimba", "Petauke", "Sinda", "Vubwi"]),
        "Luapula": ("LUA",
                    ["Chembe", "Chiengi", "Chipili", "Kawambwa", "Lunga", "Mansa", "Milenge", "Mwansabombwe", "Mwense",
                     "Nchelenge", "Samfya"]),
        "Lusaka": ("LSK", ["Chilanga", "Chongwe", "Kafue", "Luangwa", "Lusaka", "Rufunsa"]),
        "Muchinga": ("MCH", ["Chinsali", "Isoka", "Mafinga", "Mpika", "Nakonde", "Siavonga"]),
        "Northern": ("NOR",
                     ["Chilubi", "Kaputa", "Kasama", "Luwingu", "Mbala", "Mporokoso", "Mpulungu", "Mungwi", "Nsama"]),
        "North-Western": ("NWN", ["Chavuma", "Ikelenge", "Kabompo", "Kasempa", "Manyinga", "Mufumbwe", "Mushindamo",
                                  "Mwinilunga", "Solwezi", "Zambezi"]),
        "Southern": ("SOU",
                     ["Chikankata", "Choma", "Gwembe", "Itezhi-Tezhi", "Kalomo", "Kazungula", "Livingstone", "Mazabuka",
                      "Monze", "Namwala", "Pemba", "Sinazongwe", "Zimba"]),
        "Western": ("WES",
                    ["Kalabo", "Kaoma", "Limulunga", "Lukulu", "Mongu", "Mulobezi", "Mwandi", "Nalolo", "Nkeyema",
                     "Senanga", "Sesheke", "Shangombo", "Sikongo", "Sioma"])
    }

    print("--- Starting Seed Process ---")

    for p_name, (p_code, districts) in zambia_data.items():
        # Create or get the Province
        province_obj, created = Province.objects.get_or_create(
            name=p_name,
            defaults={'code': p_code}
        )
        if created:
            print(f"Created Province: {p_name}")

        for d_name in districts:
            # Generate a simple code for the district (First 3 letters + Province Code)
            d_code = f"{d_name[:3].upper()}-{p_code}"

            # Create or get the District linked to this Province
            district_obj, d_created = District.objects.get_or_create(
                name=d_name,
                province=province_obj,
                defaults={'code': d_code}
            )
            if d_created:
                print(f"  + Added District: {d_name}")

    print("--- Seeding Complete! ---")


if __name__ == "__main__":
    seed_data()