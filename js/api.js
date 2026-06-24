const API_BASE = "https://members-api.parliament.uk/api";
const SNAPSHOT_URL = "./data/members-snapshot.json";

async function fetchSnapshotMembers() {
  const response = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Snapshot fetch failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload?.members)) {
    throw new Error('Snapshot payload is missing members array');
  }

  return payload.members;
}

/**
 * Fetch one page of members from the Parliament API
 */
async function fetchMemberPage(skip = 0, take = 20, house = "Commons") {
  const params = new URLSearchParams({
    House: house,
    IsCurrentMember: "true",
    skip,
    take
  });
  const resp = await fetch(`${API_BASE}/Members/Search?${params}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status} at skip=${skip}`);
  return resp.json();
}

/**
 * Strip honorifics from a Commons member's display name
 */
function stripHonorifics(name) {
  return name
    .replace(/^(Rt Hon |Rt\. Hon\. |Mr |Mrs |Ms |Miss |Dr |Sir |Dame )+/i, "")
    .trim();
}

/**
 * Clean a Lords member's display name:
 * - Remove "The Right Honourable" / "The Rt Hon" / "Rt. Hon." variants
 * - Remove leading "The"
 * - Remove postnominals after a comma
 */
function cleanLordsName(name) {
  let cleaned = name.trim();

  // Remove "The Right Honourable" in full
  cleaned = cleaned.replace(/^The\s+Right\s+Honourable\s+/i, '');

  // Remove "The Rt. Hon." / "The Rt Hon" variants
  cleaned = cleaned.replace(/^The\s+Rt\.?\s*Hon\.?\s+/i, '');

  // Remove "Rt. Hon." / "Rt Hon" without "The"
  cleaned = cleaned.replace(/^Rt\.?\s*Hon\.?\s+/i, '');

  // Remove leading "The "
  cleaned = cleaned.replace(/^The\s+/i, '');

  // Remove postnominals after a comma (e.g. ", PC, CBE")
  // Remove trailing honours (comma-separated or space-separated)
  cleaned = cleaned
    .replace(/,\s*(?:[A-Z]{2,}(?:\s*,\s*[A-Z]{2,})*)$/, '')
    .replace(/\s+(?:[A-Z]{2,}(?:\s+[A-Z]{2,})*)$/, '');
  return cleaned.trim();
}

/**
 * Parse a raw API member object into a clean member object
 */
function parseMember(item, house) {
  const v = item.value;
  const bgCol = v.latestParty?.backgroundColour;

  return {
    id: v.id,
    name: house === "Commons"
      ? stripHonorifics(v.nameDisplayAs)
      : cleanLordsName(v.nameDisplayAs),
    house,
    party: v.latestParty?.name || 'Unknown',
    partyColour: bgCol && bgCol.length ? `#${bgCol}` : "#000000",
    membershipFrom: v.latestHouseMembership?.membershipFrom ?? null,
    gender: v.gender ?? null,
    thumbnailUrl: v.thumbnailUrl ?? null,
  };
}

/**
 * Fetch all members for a given house, paginating automatically
 */
async function fetchAllMembers(house = "Commons") {
  const first = await fetchMemberPage(0, 20, house);
  const total = first.totalResults;
  const firstMembers = first.items.map(item => parseMember(item, house));

  const skips = [];
  for (let skip = 20; skip < total; skip += 20) skips.push(skip);

  const pageResults = await Promise.allSettled(
    skips.map(skip => fetchMemberPage(skip, 20, house))
  );

  const pages = pageResults
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  const remainingMembers = pages.flatMap(
    page => page.items.map(item => parseMember(item, house))
  );

  return [...firstMembers, ...remainingMembers];
}

/**
 * Fetch all Commons and Lords members
 */
async function fetchAllParliamentMembers() {
  try {
    return await fetchSnapshotMembers();
  } catch {
    // Fall back to live API if snapshot is missing or invalid.
  }

  const [commonsResult, lordsResult] = await Promise.allSettled([
    fetchAllMembers("Commons"),
    fetchAllMembers("Lords")
  ]);

  const commons = commonsResult.status === 'fulfilled' ? commonsResult.value : [];
  const lords = lordsResult.status === 'fulfilled' ? lordsResult.value : [];

  if (!commons.length && !lords.length) {
    const firstError = commonsResult.status === 'rejected'
      ? commonsResult.reason
      : lordsResult.status === 'rejected'
        ? lordsResult.reason
        : new Error('Failed to fetch members');
    throw firstError;
  }

  return [...commons, ...lords];
}

export { fetchAllParliamentMembers };