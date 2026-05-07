import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const resources = {
  en: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Settings",

      // Settings
      "Account Preferences": "Account Preferences",
      "Security & Privacy": "Security & Privacy",
      "Notification Settings": "Notification Settings",
      "Language": "Language",
      "Theme": "Theme",
      "Linked Devices": "Linked Devices",
      "Two-Factor Auth": "Two-Factor Auth",
      "Change Password": "Change Password",
      "Privacy Mode": "Privacy Mode",
      "Email Notifications": "Email Notifications",
      "Push Notifications": "Push Notifications",
      "SMS Alerts": "SMS Alerts",
      "Newsletter": "Newsletter",

      // Common
      "English (UK)": "English (UK)",
      "System Default": "System Default",
      "Available": "Available",
      "Secure account": "Secure account",
      "Standard": "Standard",
      "1 Device": "1 Device",

      // Descriptions
      "Manage your preferences and security": "Manage your preferences and security",
      "Receive updates about your ID via email.": "Receive updates about your ID via email.",
      "Get real-time alerts on your smartphone.": "Get real-time alerts on your smartphone.",
      "Critical security alerts via text message.": "Critical security alerts via text message.",
      "Receive monthly updates from Digital ID Zambia.": "Receive monthly updates from Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "My ID Wallet",
      "Profile": "Profile",
      "Family Tree": "Family Tree",
      "Activity Log": "Activity Log",
      "Notifications": "Notifications",
      "Partners": "Partners",
      "Certificates": "Certificates",

      // Page titles and subtitles
      "My Digital ID Wallet": "My Digital ID Wallet",
      "My Profile": "My Profile",
      "My Family Tree": "My Family Tree",
      "Official Partners": "Official Partners",
      "Manage and share your identity": "Manage and share your identity",
      "View and manage your personal details": "View and manage your personal details",
      "View your verified family connections": "View your verified family connections",
      "A history of your identity usage": "A history of your identity usage",
      "Stay updated on your ID status": "Stay updated on your ID status",
      "Connect with verified services and institutions": "Connect with verified services and institutions",
      "Manage your preferences and security": "Manage your preferences and security",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  },
  bemba: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Amalengeshoni",

      // Settings
      "Account Preferences": "Amalengeshoni ya Akaunti",
      "Security & Privacy": "Ubulamfumu & Ubulikilo",
      "Notification Settings": "Amalengeshoni ya Mipupo",
      "Language": "Lulimi",
      "Theme": "Icipande",
      "Linked Devices": "Amashini Yalumfwana",
      "Two-Factor Auth": "Ubulamfumu bwa Mafuta Abili",
      "Change Password": "Leka ijwi la kupita",
      "Privacy Mode": "Mumwenso wa Ubulikilo",
      "Email Notifications": "Mipupo ya Email",
      "Push Notifications": "Mipupo ya Push",
      "SMS Alerts": "Mipupo ya SMS",
      "Newsletter": "Mipupo ya Nyishi",

      // Common
      "English (UK)": "Ichibemba",
      "System Default": "Ifyo Leshima",
      "Available": "Ilipezeka",
      "Secure account": "Akaunti yabulamfumu",
      "Standard": "Ifyo Leshima",
      "1 Device": "Ishinino 1",

      // Descriptions
      "Manage your preferences and security": "Lolesha amalengeshoni yenu ne bulamfumu",
      "Receive updates about your ID via email.": "Pokelela mipupo ya ID yenu pa email.",
      "Get real-time alerts on your smartphone.": "Pokelela mipupo ya pa nshi pa smartphone yenu.",
      "Critical security alerts via text message.": "Mipupo mikalamba ya bulamfumu pa text message.",
      "Receive monthly updates from Digital ID Zambia.": "Pokelela mipupo ya mweshi na mweshi ku Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "Ichibemba ID Wallet",
      "Profile": "Profile",
      "Family Tree": "Umushi wa Babanze",
      "Activity Log": "Mipupo ya Ntchito",
      "Notifications": "Mipupo",
      "Partners": "Abalumfwana",
      "Certificates": "Mapepala",

      // Page titles and subtitles
      "My Digital ID Wallet": "Ichibemba Digital ID Wallet",
      "My Profile": "Profile Yangu",
      "My Family Tree": "Umushi wa Babanze",
      "Official Partners": "Abalumfwana Ba Boma",
      "Manage and share your identity": "Lolesha ne kupa abalumi ID yenu",
      "View and manage your personal details": "Mona ne kulesha makatipa yenu",
      "View your verified family connections": "Mona abalumfwana benu ba babanze abalondolwe",
      "A history of your identity usage": "Mipupo ya kushimikwa kwa ID yenu",
      "Stay updated on your ID status": "Khalani na mipupo ya ID yenu",
      "Connect with verified services and institutions": "Lumikani na masevisi ne mabungwe alondolwe",
      "Manage your preferences and security": "Lolesha amalengeshoni yenu ne bulamfumu",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  },
  nyanja: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Zokonda",

      // Settings
      "Account Preferences": "Zokonda za Akaunti",
      "Security & Privacy": "Chitetezo & Chinsinsi",
      "Notification Settings": "Zokonda za Zidziwitso",
      "Language": "Chilankhulo",
      "Theme": "Mutu",
      "Linked Devices": "Zipangizo Zolumikizana",
      "Two-Factor Auth": "Chitetezo cha Magawo Awiri",
      "Change Password": "Sinthani Mawu Achinsinsi",
      "Privacy Mode": "Njira Yachinsinsi",
      "Email Notifications": "Zidziwitso za Email",
      "Push Notifications": "Zidziwitso za Push",
      "SMS Alerts": "Zidziwitso za SMS",
      "Newsletter": "Kalatini",

      // Common
      "English (UK)": "Chinyanja",
      "System Default": "Mwachibadwa",
      "Available": "Zikupezeka",
      "Secure account": "Akaunti yotetezedwa",
      "Standard": "Mwachibadwa",
      "1 Device": "Chipangizo 1",

      // Descriptions
      "Manage your preferences and security": "Sinthani zokonda zanu ndi chitetezo",
      "Receive updates about your ID via email.": "Landirani zidziwitso za ID yanu pa email.",
      "Get real-time alerts on your smartphone.": "Pezani zidziwitso zenizeni pa smartphone yanu.",
      "Critical security alerts via text message.": "Zidziwitso zofunika za chitetezo pa text message.",
      "Receive monthly updates from Digital ID Zambia.": "Landirani zidziwitso za mwezi uliwonse ku Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "Chinyanja ID Wallet",
      "Profile": "Mbiri",
      "Family Tree": "Mtengo wa Banja",
      "Activity Log": "Zolemba za Ntchito",
      "Notifications": "Zidziwitso",
      "Partners": "Othandizana Nawo",
      "Certificates": "Ziphaso",

      // Page titles and subtitles
      "My Digital ID Wallet": "Chinyanja Digital ID Wallet",
      "My Profile": "Mbiri Yanga",
      "My Family Tree": "Mtengo wa Banja Langa",
      "Official Partners": "Othandizana Nawo a Boma",
      "Manage and share your identity": "Sinthani ndi kugawana ID yanu",
      "View and manage your personal details": "Onani ndi kusintha zambiri zanu",
      "View your verified family connections": "Onani maulumikiro a banja lanu olondolera",
      "A history of your identity usage": "Mbiri ya kugwiritsira ntchito ID yanu",
      "Stay updated on your ID status": "Khalani ndi zidziwitso za ID yanu",
      "Connect with verified services and institutions": "Lumikizanani ndi mautumiki ndi mabungwe olondolera",
      "Manage your preferences and security": "Sinthani zokonda zanu ndi chitetezo",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  },
  tonga: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Zwiimba",

      // Settings
      "Account Preferences": "Zwiimba zwi akaunti",
      "Security & Privacy": "Vuhlayiseki & Vuhlayiseki",
      "Notification Settings": "Zwiimba zwi swi livisa",
      "Language": "Lulimi",
      "Theme": "Sumbu",
      "Linked Devices": "Switirho swi lumeka",
      "Two-Factor Auth": "Vuhlayiseki bya swipimo swibili",
      "Change Password": "Cinca phasiwedi",
      "Privacy Mode": "Mufumo wa vuhlayiseki",
      "Email Notifications": "Swi livisa swa email",
      "Push Notifications": "Swi livisa swa push",
      "SMS Alerts": "Swi livisa swa SMS",
      "Newsletter": "Kuhumesa",

      // Common
      "English (UK)": "Sitonga",
      "System Default": "Mwa sisitemu",
      "Available": "Kuli pezeka",
      "Secure account": "Akaunti ya vuhlayiseki",
      "Standard": "Mwa sisitemu",
      "1 Device": "Citirho 1",

      // Descriptions
      "Manage your preferences and security": "Lawula zwiimba zwanu na vuhlayiseki",
      "Receive updates about your ID via email.": "Amukela swi livisa swa ID yanu nga email.",
      "Get real-time alerts on your smartphone.": "Amukela swi livisa swa nthawi yeniyi pa smartphone yanu.",
      "Critical security alerts via text message.": "Swi livisa swa vuhlayiseki swa nkhanu nga text message.",
      "Receive monthly updates from Digital ID Zambia.": "Amukela swi livisa swa mwesi na mwesi ku Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "Sitonga ID Wallet",
      "Profile": "Mbiri",
      "Family Tree": "Muti wa Muzinda",
      "Activity Log": "Zwiimba zwi ntchito",
      "Notifications": "Swi livisa",
      "Partners": "Swakha",
      "Certificates": "Zwi phapha",

      // Page titles and subtitles
      "My Digital ID Wallet": "Sitonga Digital ID Wallet",
      "My Profile": "Mbiri Yangu",
      "My Family Tree": "Muti wa Muzinda wangu",
      "Official Partners": "Swakha swa Boma",
      "Manage and share your identity": "Lawula na kupeela ID yanu",
      "View and manage your personal details": "Wona na kulawula zwiimba zwanu",
      "View your verified family connections": "Wona swakha swa muzinda swa swa vuhlayiseki",
      "A history of your identity usage": "Mbiri ya kushandisa ID yanu",
      "Stay updated on your ID status": "Khalani na swi livisa swa ID yanu",
      "Connect with verified services and institutions": "Lumikani na misebezi na mabungwe a vuhlayiseki",
      "Manage your preferences and security": "Lawula zwiimba zwanu na vuhlayiseki",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  },
  lozi: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Disetings",

      // Settings
      "Account Preferences": "Disetings tsa Akaunti",
      "Security & Privacy": "Tshireletso & Sephiri",
      "Notification Settings": "Disetings tsa Ditlhahlo",
      "Language": "Polelo",
      "Theme": "Lenaneo",
      "Linked Devices": "Didirisiwa tse di Golaganyeng",
      "Two-Factor Auth": "Tshireletso ya Melemo e Mebedi",
      "Change Password": "Fetola Phasewete",
      "Privacy Mode": "Mofuta wa Sephiri",
      "Email Notifications": "Ditlhahlo tsa Email",
      "Push Notifications": "Ditlhahlo tsa Push",
      "SMS Alerts": "Ditlhahlo tsa SMS",
      "Newsletter": "Kwaelakgang",

      // Common
      "English (UK)": "Silozi",
      "System Default": "Ya Tsamaiso",
      "Available": "E teng",
      "Secure account": "Akaunti e sireletsegile",
      "Standard": "Ya Tsamaiso",
      "1 Device": "Sedirisiwa 1",

      // Descriptions
      "Manage your preferences and security": "Laola disetings tsa gago le tshireletso",
      "Receive updates about your ID via email.": "Amogela ditlhahlo tsa ID ya gago ka email.",
      "Get real-time alerts on your smartphone.": "Amogela ditlhahlo tsa nako ya nnete mo smartphone ya gago.",
      "Critical security alerts via text message.": "Ditlhahlo tsa tshireletso tsa bohlokwa ka text message.",
      "Receive monthly updates from Digital ID Zambia.": "Amogela ditlhahlo tsa kgwedi le kgwedi go Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "Silozi ID Wallet",
      "Profile": "Tlhaloso",
      "Family Tree": "Selo sa Losika",
      "Activity Log": "Lenaneo la Ditiragalo",
      "Notifications": "Ditlhahlo",
      "Partners": "Badiri",
      "Certificates": "Ditshupetso",

      // Page titles and subtitles
      "My Digital ID Wallet": "Silozi Digital ID Wallet",
      "My Profile": "Tlhaloso ya me",
      "My Family Tree": "Selo sa Losika sa me",
      "Official Partners": "Badiri ba Semmuso",
      "Manage and share your identity": "Laola le go abela boitsebiso jwa gago",
      "View and manage your personal details": "Leba le go laola dintlha tsa gago",
      "View your verified family connections": "Leba dikgokagano tsa losika tsa gago tse di netefaditsweng",
      "A history of your identity usage": "Lenaneo la tshebediso ya boitsebiso jwa gago",
      "Stay updated on your ID status": "Dula o na le ditlhahlo tsa boemo jwa ID ya gago",
      "Connect with verified services and institutions": "Gokagana le ditirelo le mekgatlho e e netefaditsweng",
      "Manage your preferences and security": "Laola dikgetho tsa gago le tshireletso",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  },
  kaonde: {
    translation: {
      // Navigation
      "Dashboard": "Dashboard",
      "ID Card": "ID Card",
      "Verification": "Verification",
      "Settings": "Mashintulo",

      // Settings
      "Account Preferences": "Mashintulo a Akaunti",
      "Security & Privacy": "Vuseke & Buseke",
      "Notification Settings": "Mashintulo a Myelele",
      "Language": "Lulimi",
      "Theme": "Citapi",
      "Linked Devices": "Mashini a Kulangana",
      "Two-Factor Auth": "Vuseke va Bintu Bibili",
      "Change Password": "Shintulula Kapasi",
      "Privacy Mode": "Mufunga wa Buseke",
      "Email Notifications": "Myelele ya Email",
      "Push Notifications": "Myelele ya Push",
      "SMS Alerts": "Myelele ya SMS",
      "Newsletter": "Kupetela",

      // Common
      "English (UK)": "Chikaonde",
      "System Default": "Mwa Sitemu",
      "Available": "Kuli kupezeka",
      "Secure account": "Akaunti ya vuseke",
      "Standard": "Mwa Sitemu",
      "1 Device": "Mushini 1",

      // Descriptions
      "Manage your preferences and security": "Lolesha mashintulo enu na vuseke",
      "Receive updates about your ID via email.": "Pokelela myelele ya ID yenu pa email.",
      "Get real-time alerts on your smartphone.": "Pokelela myelele ya pa nshi pa smartphone yenu.",
      "Critical security alerts via text message.": "Myelele mikalamba ya vuseke pa text message.",
      "Receive monthly updates from Digital ID Zambia.": "Pokelela myelele ya mweshi na mweshi ku Digital ID Zambia.",

      // Navigation items
      "My ID Wallet": "Chikaonde ID Wallet",
      "Profile": "Mushintulo",
      "Family Tree": "Muti wa Bantu",
      "Activity Log": "Mushintulo wa Mishimo",
      "Notifications": "Myelele",
      "Partners": "Bakwasha",
      "Certificates": "Mapepala",

      // Page titles and subtitles
      "My Digital ID Wallet": "Chikaonde Digital ID Wallet",
      "My Profile": "Mushintulo wangu",
      "My Family Tree": "Muti wa Bantu wangu",
      "Official Partners": "Bakwasha ba Boma",
      "Manage and share your identity": "Lolesha na kupeela ID yenu",
      "View and manage your personal details": "Mona na kulolesha mashintulo enu",
      "View your verified family connections": "Mona bakwasha ba bantu benu balondolwe",
      "A history of your identity usage": "Mushintulo wa kushimikwa kwa ID yenu",
      "Stay updated on your ID status": "Khalani na myelele ya ID yenu",
      "Connect with verified services and institutions": "Lumikani na misebe na mabungwe alondolwe",
      "Manage your preferences and security": "Lolesha mashintulo enu na vuseke",
      "Digital ID Wallet": "Digital ID Wallet",
    }
  }
}

// Export the i18n instance without auto-initializing
export const i18nConfig = {
  resources,
  fallbackLng: 'en',
  debug: false,

  interpolation: {
    escapeValue: false,
  },

  detection: {
    order: typeof window !== 'undefined' ? ['localStorage', 'navigator', 'htmlTag'] : ['htmlTag'],
    caches: typeof window !== 'undefined' ? ['localStorage'] : [],
  },

  // Prevent SSR issues
  react: {
    useSuspense: false,
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)

export default i18n