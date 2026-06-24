#!/usr/bin/env node
/**
 * Enrich members snapshot with survey scores from the CSV
 * Usage: node scripts/enrich-members-snapshot.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = path.join(__dirname, '../data/members-snapshot.json');

// Normalization functions (same as in app.js)
function normalizeText(value) {
  return (value || '').toString().trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSurname(fullName) {
  const normalized = normalizeText(fullName);
  const parts = normalized.split(' ').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

// Parse CSV text
function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { 
          current += '"'; 
          i += 1; 
        } else { 
          inQuotes = false; 
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(current); 
      current = '';
    } else if (char === '\r') {
      continue;
    } else if (char === '\n') {
      row.push(current); 
      rows.push(row); 
      current = ''; 
      row = [];
    } else {
      current += char;
    }
  }
  
  if (current !== '' || row.length) { 
    row.push(current); 
    rows.push(row); 
  }
  
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.map(values => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

async function fetchCsv(url) {
  console.log(`Fetching survey data from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }
  return response.text();
}

async function buildSurveyMap(csvText) {
  const entries = parseCsv(csvText);
  const byDisplayName = new Map();
  const bySurnameSeat = new Map();
  
  entries.forEach(entry => {
    const displayNameKey = normalizeText(entry.DisplayName);
    if (displayNameKey) byDisplayName.set(displayNameKey, entry);
    
    const surnameKey = extractSurname(entry.DisplayName);
    const seatNameKey = normalizeText(entry.PCON24NM || entry.PCON22NM || '');
    const seatCodeKey = normalizeText(entry.PCON24CD || entry.PCON22CD || '');
    
    if (surnameKey && seatCodeKey) {
      bySurnameSeat.set(`${surnameKey}|${seatCodeKey}`, entry);
    }
    if (surnameKey && seatNameKey) {
      bySurnameSeat.set(`${surnameKey}|${seatNameKey}`, entry);
    }
  });
  
  return { byDisplayName, bySurnameSeat };
}

function findSurveyEntry(member, surveyMap) {
  // Try exact name match
  const exactMatch = surveyMap.byDisplayName.get(normalizeText(member.name));
  if (exactMatch) return exactMatch;
  
  // Try surname + seat name
  const surname = extractSurname(member.name);
  const seatName = normalizeText(member.membershipFrom || '');
  if (surname && seatName) {
    const nameMatch = surveyMap.bySurnameSeat.get(`${surname}|${seatName}`);
    if (nameMatch) return nameMatch;
  }
  
  return null;
}

function enrichMember(member, surveyMap) {
  const surveyEntry = findSurveyEntry(member, surveyMap);
  
  if (surveyEntry) {
    return {
      ...member,
      econ_mean: surveyEntry.econ_mean ? parseFloat(surveyEntry.econ_mean) : null,
      econ_lo: surveyEntry.econ_lo ? parseFloat(surveyEntry.econ_lo) : null,
      econ_hi: surveyEntry.econ_hi ? parseFloat(surveyEntry.econ_hi) : null,
      cult_mean: surveyEntry.cult_mean ? parseFloat(surveyEntry.cult_mean) : null,
      cult_lo: surveyEntry.cult_lo ? parseFloat(surveyEntry.cult_lo) : null,
      cult_hi: surveyEntry.cult_hi ? parseFloat(surveyEntry.cult_hi) : null
    };
  }
  
  return {
    ...member,
    econ_mean: null,
    econ_lo: null,
    econ_hi: null,
    cult_mean: null,
    cult_lo: null,
    cult_hi: null
  };
}

async function main() {
  try {
    // Load current snapshot
    console.log('Loading current snapshot...');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const members = snapshot.members || [];
    console.log(`Found ${members.length} members in snapshot`);
    
    // Fetch survey data
    let csvText;
    try {
      csvText = await fetchCsv('https://raw.githubusercontent.com/chrishanretty/pairwise_mps_2024/main/outputs/summary_statistics_file.csv');
    } catch {
      console.log('Primary URL failed, trying CDN fallback...');
      csvText = await fetchCsv('https://cdn.jsdelivr.net/gh/chrishanretty/pairwise_mps_2024@main/outputs/summary_statistics_file.csv');
    }
    
    console.log(`Fetched CSV: ${csvText.length} bytes`);
    
    // Build survey map
    console.log('Building survey data index...');
    const surveyMap = await buildSurveyMap(csvText);
    console.log(`Survey map: ${surveyMap.byDisplayName.size} by display name, ${surveyMap.bySurnameSeat.size} by surname+seat`);
    
    // Enrich members
    console.log('Enriching members with survey scores...');
    const enriched = members.map(member => enrichMember(member, surveyMap));
    
    // Count enriched members
    const withScores = enriched.filter(m => m.econ_mean !== null || m.cult_mean !== null).length;
    console.log(`Enriched ${withScores} of ${enriched.length} members with survey scores`);
    
    // Check specific MPs
    const babarinde = enriched.find(m => m.name === 'Josh Babarinde');
    const botterill = enriched.find(m => m.name === 'Jade Botterill');
    const dollimore = enriched.find(m => m.name === 'Helena Dollimore');
    
    console.log('\nTarget MPs:');
    console.log(`- Josh Babarinde: econ=${babarinde?.econ_mean}, cult=${babarinde?.cult_mean}`);
    console.log(`- Jade Botterill: econ=${botterill?.econ_mean}, cult=${botterill?.cult_mean}`);
    console.log(`- Helena Dollimore: econ=${dollimore?.econ_mean}, cult=${dollimore?.cult_mean}`);
    
    // Save enriched snapshot
    const enrichedSnapshot = {
      generatedAt: new Date().toISOString(),
      members: enriched
    };
    
    fs.writeFileSync(snapshotPath, JSON.stringify(enrichedSnapshot, null, 2));
    console.log(`\nSaved enriched snapshot to ${snapshotPath}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
