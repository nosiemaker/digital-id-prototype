import urllib.request
import json
try:
    req = urllib.request.Request(
        'http://localhost:8000/auth/login', 
        data=b'{"email":"ro@zdid.zm","password":"zdid1234"}', 
        headers={'Content-Type': 'application/json'}, 
        method='POST'
    )
    res = urllib.request.urlopen(req)
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print('Status:', e.code)
    print('Body:', e.read().decode())
except Exception as e:
    print('Error:', e)
