'use client';
import { useState } from 'react';
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false);
 return <main><section className="panel"><a href="/">Denlumi</a><h1>Sign in to your local account</h1><p>Use an existing verified account in this isolated local installation. Signing in again creates a fresh authenticated session; it does not change household permissions. Anonymous samples have no password and cannot use this form.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!r.ok)throw Error('Sign-in failed. Check the account and password.');setPassword('');setSignedIn(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>Sign in</button></form>
 {error&&<p className="error" role="alert">{error}</p>}{signedIn&&<p role="status">Signed in. <a href="/">Return to your household</a> or <a href="/shared">open a private shared record</a>.</p>}
 </section></main>;
}
