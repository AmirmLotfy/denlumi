import Console from './console';
import providerEvidence from '../../../evidence/phase6/providers.json';
export const dynamic='force-dynamic';
export default function Page(){return <Console providerEvidence={providerEvidence} speechEnabled={process.env.SPEECH_ENABLED==='true'} />;}
