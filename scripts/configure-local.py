"""Write local runtime secrets without printing them. Never use for hosted projects."""
import json, os, subprocess
from pathlib import Path
from urllib.parse import urlparse
p=Path('.env.local')
if p.exists(): raise SystemExit('.env.local already exists; preserve it and edit deliberately.')
# Respect the caller's Docker context/DOCKER_HOST; do not assume a person's home directory.
command = (['supabase','stack','status','--output-format','json']
           if os.environ.get('SUPABASE_EXPERIMENTAL_STACK') == '1'
           else ['supabase','status','-o','json'])
try:
 r = subprocess.run(command, env=dict(os.environ), capture_output=True, text=True)
except OSError:
 raise SystemExit('Install the pinned Supabase CLI and start the local stack first. CLI output withheld.')
if r.returncode:
 raise SystemExit('Could not read local Supabase status. Check the pinned CLI, runtime and working directory. CLI output withheld.')
try:
 s = json.loads(r.stdout)
except json.JSONDecodeError:
 raise SystemExit('Local Supabase status was not valid JSON. CLI output withheld.')
if not isinstance(s,dict): raise SystemExit('Unexpected local status shape. CLI output withheld.')
# CLI 2.121's experimental local stack nests the same connection keys in env.
s = s.get('env', s)
if not isinstance(s,dict): raise SystemExit('Unexpected local connection shape. CLI output withheld.')
if any(not isinstance(s.get(key),str) or not s[key] or any(c in s[key] for c in '\r\n\x00') for key in ('API_URL','DB_URL','ANON_KEY','SERVICE_ROLE_KEY')):
 raise SystemExit('Local connection fields must be nonempty single-line strings; values withheld.')
api=urlparse(s['API_URL']); database=urlparse(s['DB_URL'])
if api.scheme!='http' or api.hostname not in ('127.0.0.1','localhost') or api.port!=55431 or api.username is not None or api.password is not None or api.path not in ('','/') or api.query or api.fragment:
 raise SystemExit('Only isolated localhost Supabase on port 55431 is permitted.')
if database.scheme not in ('postgres','postgresql') or database.hostname not in ('127.0.0.1','localhost') or database.port!=55432 or database.query or database.fragment or not database.username or len(database.path)<2:
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
