"""Validate specification consistency, not a running product or animal safety."""
from pathlib import Path
import json, re, uuid, hashlib, sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def ok(name,condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
def read(p): return json.loads((ROOT/p).read_text())
for p in ROOT.rglob('*.json'):
    json.loads(p.read_text())
ok('All JSON files parse',True)
model=read('contracts/entities.json'); entities=model['entities']; names={e['name'] for e in entities}
ok('Logical entity count and names agree',len(entities)==len(names)==model['entity_count'])
ok('All foreign-key targets exist',all(f['references'] in names for e in entities for f in e['fields'] if 'references' in f))
ok('All entity field names are unique',all(len(e['fields'])==len({f['name'] for f in e['fields']}) for e in entities))
sources={s['id'] for s in read('contracts/source-register.json')['sources']}
used=set()
for p in (ROOT/'docs').glob('*.md'):
    used.update(re.findall(r'\[(S\d+)\]',p.read_text()))
ok('Every cited source key is registered',used<=sources)
protocols=read('fixtures/demo_protocols.json')['protocols']; pids={p['id'] for p in protocols}
ok('All demo protocols are unapproved for live use',all(p['status']=='demo_only' and p['approved_for_live_use'] is False and p['reviewer_id'] is None for p in protocols))
ok('No sample protocol specifies an animal-session duration',all(p['default_session_duration_seconds'] is None for p in protocols))
ok('Protocol source references exist',all(set(p['source_ids'])<=sources for p in protocols))
try:
    import jsonschema
except ImportError as exc:
    raise RuntimeError('Install jsonschema to validate the contract schemas before claiming validation.') from exc
ps=read('contracts/protocol.schema.json')
jsonschema.Draft202012Validator.check_schema(ps)
for p in protocols: jsonschema.validate(p,ps,format_checker=jsonschema.FormatChecker())
ok('Seven demo protocols validate against the JSON Schema',len(protocols)==7)
scenario=read('fixtures/scenarios.json')['scenarios']
ok('All 17 scenario fixtures present',len(scenario)==17 and {s['id'] for s in scenario}=={f'SC{i:02d}' for i in range(1,18)})
ok('Scenario protocol IDs resolve',all(s['demo_protocol_id'] in pids for s in scenario))
ok('All species pairings and solo routes represented',{'cat_cat','dog_dog','cat_dog','single_cat','single_dog'}<={p['pairing'] for p in protocols})
for hh in read('fixtures/demo_households.json')['households']:
    uuid.UUID(hh['id']); pets={p['id']:p for p in hh['pets']}
    assert hh['mode']=='demo' and hh['fictional'] and not hh['professional_approval_claimed']
    for p in hh['pets']: assert p['household_id']==hh['id']; uuid.UUID(p['id'])
    seen=set()
    for pair in hh['pairs']:
        a,b=pair['pet_a_id'],pair['pet_b_id']
        assert a in pets and b in pets and a<b and (a,b) not in seen and pair['household_id']==hh['id']
        seen.add((a,b))
    assert set(hh['case']['participant_ids'])<=set(pets)
ok('Fictional household IDs, pairs and tenant scopes are consistent',True)
tools=read('contracts/tool-schemas.json')['tools']; toolnames={t['name'] for t in tools}
for t in tools: jsonschema.Draft202012Validator.check_schema(t['inputSchema'])
ok('Nine tool schemas have unique names and reject extra inputs',len(tools)==len(toolnames)==9 and all(t['inputSchema']['additionalProperties'] is False for t in tools))
forbidden={'approve_plan','clear_hold','send_email','open_door','prescribe','mark_compatible'}
ok('No forbidden consequential tool is exposed',toolnames.isdisjoint(forbidden))
tests=read('qa/acceptance-tests.json')
ok('Acceptance definitions are unique and explicitly unexecuted',len(tests['tests'])==tests['count']==len({t['id'] for t in tests['tests']}) and all(t['execution_status'].startswith('not_run') for t in tests['tests']))
# WCAG contrast arithmetic for intended small-text roles, not a complete accessibility audit.
def lum(h):
    vals=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    lin=[v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in vals]
    return sum(a*b for a,b in zip(lin,[0.2126,0.7152,0.0722]))
def ratio(a,b):
    lo,hi=sorted([lum(a),lum(b)])
    return (hi+0.05)/(lo+0.05)
c=read('brand/tokens.json')['colors']
pairs=[('ink','canvas'),('secondary','surface'),('surface','action'),('warning','surface'),('danger','surface'),('info','surface')]
contrasts={f'{a}_on_{b}':round(ratio(c[a],c[b]),3) for a,b in pairs}
ok('Specified normal-text contrast pairs meet 4.5 to 1',all(v>=4.5 for v in contrasts.values()))
report={'status':'passed_specification_consistency_checks','checks_passed':len(checks),'checks':checks,'logical_entities':len(entities),'scenario_fixtures':len(scenario),'protocol_fixtures':len(protocols),'tool_contracts':len(tools),'acceptance_test_definitions':tests['count'],'text_contrast_ratios':contrasts,'not_tested':['application implementation','live provider APIs','database migrations or RLS execution','real animal handling','clinical efficacy','trademark or domain availability','rendered UI accessibility','native Alexa publication','rendered Mermaid graphics']}
(ROOT/'qa/validation_report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
