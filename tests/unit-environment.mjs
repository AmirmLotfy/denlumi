// Pure tests import domain errors/MCP declarations but must never access a DB.
// Give pool construction an explicit harmless local locator; reject every read.
import pg from 'pg';
process.env.DATABASE_URL='postgresql://unit:unit@127.0.0.1:55432/denlumi_unit_not_connected';
const refuse=()=>{throw Error('DATABASE_ACCESS_IN_PURE_UNIT_TEST');};
pg.Pool.prototype.connect=refuse;
pg.Pool.prototype.query=refuse;
