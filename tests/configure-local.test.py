"""Credential-file boundary tests. Fake CLI output; no Docker or provider access."""
import json, os, stat, subprocess, tempfile, unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/'scripts/configure-local.py'

class ConfigureLocal(unittest.TestCase):
 def run_case(self, api='http://127.0.0.1:55431', db='postgresql://postgres:postgres@127.0.0.1:55432/postgres', existing=False, nested=False):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder); cli=root/'supabase'
   payload={'API_URL':api,'DB_URL':db,'ANON_KEY':'fictional-test-public-key','SERVICE_ROLE_KEY':'fictional-test-private-key'}
   if nested: payload={'runtime':'native','env':payload}
   cli.write_text('#!/usr/bin/env python3\nimport os\nassert os.environ.get("DOCKER_HOST")=="test-context-preserved"\nprint('+repr(json.dumps(payload))+')\n')
   cli.chmod(0o700)
   if existing: (root/'.env.local').write_text('do-not-overwrite')
   result=subprocess.run(['python3',str(SCRIPT)],cwd=root,env={**os.environ,'PATH':str(root)+os.pathsep+os.environ['PATH'],'DOCKER_HOST':'test-context-preserved'},capture_output=True,text=True)
   target=root/'.env.local'
   return result,target.read_text() if target.exists() else None,stat.S_IMODE(target.stat().st_mode) if target.exists() else None
 def test_local_credentials_are_private_and_not_printed(self):
  r,content,mode=self.run_case()
  self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(mode,0o600)
  self.assertIn('fictional-test-private-key',content)
  self.assertNotIn('fictional-test-private-key',r.stdout+r.stderr)
 def test_existing_environment_is_preserved(self):
  r,content,_=self.run_case(existing=True)
  self.assertNotEqual(r.returncode,0);self.assertEqual(content,'do-not-overwrite')
 def test_native_status_uses_same_local_only_and_private_file_rules(self):
  r,content,mode=self.run_case(nested=True)
  self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(mode,0o600)
  self.assertIn('SUPABASE_URL=http://127.0.0.1:55431',content)
  r,content,_=self.run_case(nested=True,api='https://example.supabase.co')
  self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_hosted_auth_is_refused(self):
  r,content,_=self.run_case(api='https://example.supabase.co')
  self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_hosted_database_is_refused(self):
  r,content,_=self.run_case(db='postgresql://postgres:password@example.com:55432/postgres')
  self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_prefix_spoof_is_refused(self):
  r,content,_=self.run_case(api='http://127.0.0.1:55431@remote.example')
  self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_ambiguous_database_locations_are_refused_before_writing(self):
  for db in ['postgresql://127.0.0.1:55432/postgres','postgresql://postgres:postgres@127.0.0.1:55432','https://postgres:postgres@127.0.0.1:55432/postgres','postgresql://postgres:postgres@127.0.0.1:55432/postgres?host=remote.example','postgresql://postgres:postgres@127.0.0.1:55432/postgres#fragment']:
   with self.subTest(db=db):
    r,content,_=self.run_case(db=db)
    self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_ambiguous_api_locations_are_refused_before_writing(self):
  for api in ['http://user:password@127.0.0.1:55431','http://127.0.0.1:55431/path','http://127.0.0.1:55431?redirect=remote','http://127.0.0.1:55431#fragment']:
   with self.subTest(api=api):
    r,content,_=self.run_case(api=api)
    self.assertNotEqual(r.returncode,0);self.assertIsNone(content)
 def test_cli_values_cannot_inject_environment_lines(self):
  r,content,_=self.run_case(db='postgresql://postgres:postgres@127.0.0.1:55432/postgres\nBEDROCK_ENABLED=true')
  self.assertNotEqual(r.returncode,0);self.assertIsNone(content)

if __name__=='__main__':unittest.main()
