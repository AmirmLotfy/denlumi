"""Write local runtime secrets without printing them. Never use for hosted projects."""
import json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse
p=Path('.env.local')
if p.exists(): raise SystemExit('.env.local already exists; preserve it and edit deliberately.')
# Respect the caller's Docker context/DOCKER_HOST; do not assume a person's home directory.
r = subprocess.run(['supabase','status','-o','json'], env=dict(os.environ), capture_output=True, text=True, check=True)
s = json.loads(r.stdout)
api=urlparse(s['API_URL']); database=urlparse(s['DB_URL'])
if api.scheme!='http' or api.hostname not in ('127.0.0.1','localhost') or api.port!=55431:
 raise SystemExit('Only isolated localhost Supabase on port 55431 is permitted.')
if database.hostname not in ('127.0.0.1','localhost') or database.port!=55432:
 raise SystemExit('Only isolated localhost PostgreSQL on port 55432 is permitted.')
values = {
 'APP_ORIGIN':'http://127.0.0.1:3400', 'SUPABASE_URL':s['API_URL'],
 'SUPABASE_ANON_KEY':s['ANON_KEY'], 'SUPABASE_SERVICE_ROLE_KEY':s['SERVICE_ROLE_KEY'],
 'DATABASE_URL':s['DB_URL'], 'DENLUMI_DEMO_ENABLED':'true',
 'AWS_REGION':'us-east-1', 'AWS_PROFILE':'default',
 'BEDROCK_MODEL_ID':'us.amazon.nova-micro-v1:0', 'BEDROCK_ENABLED':'false',
 'SPEECH_ENABLED':'false', 'PROVIDER_DAILY_CALL_LIMIT':'12'
}
with open(p, 'x', opener=lambda path, flags: os.open(path, flags, 0o600)) as target:
 target.write(''.join(f'{k}={v}\n' for k,v in values.items()))
print('Local .env.local written; values withheld.')
