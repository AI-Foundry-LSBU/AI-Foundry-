import { searchTerms } from './validation.js';

// Publication and visibility are enforced in SQL before any result leaves the server.
export async function searchSolutions(pool, { role, q = '', limit = 20, state = 'all', management = false }) {
  const terms = searchTerms(q);
  const { rows } = await pool.query(`
    SELECT s.*, s.updated_at::text AS content_version, count(*) OVER ()::integer AS total_count,
      (SELECT count(*) FROM unnest($1::text[]) term
       WHERE strpos(lower(s.name || ' ' || s.description || ' ' || array_to_string(s.keywords, ' ')), term) > 0) AS relevance
    FROM solution_catalogue s
    WHERE ($2::boolean OR (s.active AND s.verified AND (s.visibility = 'all_users' OR $3 = 'manager')))
      AND (cardinality($1::text[]) = 0 OR EXISTS (
        SELECT 1 FROM unnest($1::text[]) term
        WHERE strpos(lower(s.name || ' ' || s.description || ' ' || array_to_string(s.keywords, ' ')), term) > 0
      ))
      AND ($4 = 'all' OR ($4 = 'verified' AND s.verified AND s.active)
        OR ($4 = 'draft' AND NOT s.verified AND s.active) OR ($4 = 'archived' AND NOT s.active))
    ORDER BY relevance DESC, lower(s.name), s.id LIMIT $5`,
  [terms, management && role === 'manager', role, state, limit]);
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function findPublishedSolutions(pool, ids, role) {
  const { rows } = await pool.query(`SELECT *, updated_at::text AS content_version FROM solution_catalogue
    WHERE id = ANY($1::uuid[]) AND active AND verified
      AND (visibility = 'all_users' OR $2 = 'manager')`, [ids, role]);
  return rows;
}

export async function saveSolution(pool, id, userId, data) {
  const values = [data.name, data.description, data.keywords, data.href, data.accessInstructions,
    data.visibility, data.active, data.verified, data.verificationNotes, userId];
  const assignments = `name = $1, description = $2, keywords = $3, href = $4, access_instructions = $5,
    visibility = $6, active = $7, verified = $8, verification_notes = $9,
    verified_by = CASE WHEN $8 THEN $10::uuid ELSE NULL END,
    verified_at = CASE WHEN $8 THEN clock_timestamp() ELSE NULL END,
    updated_by = $10, updated_at = clock_timestamp()`;
  const result = id
    ? await pool.query(`UPDATE solution_catalogue SET ${assignments} WHERE id = $11 RETURNING *`, [...values, id])
    : await pool.query(`INSERT INTO solution_catalogue (
        name, description, keywords, href, access_instructions, visibility, active, verified,
        verification_notes, verified_by, verified_at, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $8 THEN $10::uuid ELSE NULL END,
        CASE WHEN $8 THEN clock_timestamp() ELSE NULL END,$10,$10) RETURNING *`, values);
  return result.rows[0];
}

export function publicSolution(row) {
  return { id: row.id, name: row.name, description: row.description, href: row.href, accessInstructions: row.access_instructions };
}

export function managedSolution(row) {
  return { ...publicSolution(row), keywords: row.keywords, visibility: row.visibility,
    active: row.active, verified: row.verified, verificationNotes: row.verification_notes,
    verifiedBy: row.verified_by, verifiedAt: row.verified_at, createdBy: row.created_by,
    updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at };
}
