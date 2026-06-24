#!/usr/bin/env python3
"""
Enrich members snapshot with survey scores from Excel file
Usage: python3 scripts/enrich-members-snapshot.py
"""

import json
import zipfile
import xml.etree.ElementTree as ET
import sys
from pathlib import Path

def normalize_text(value):
    """Normalize text for matching"""
    if not value:
        return ''
    return str(value).strip().upper()

def extract_surname(full_name):
    """Extract surname from full name"""
    normalized = normalize_text(full_name)
    parts = normalized.split()
    return parts[-1] if parts else ''

def extract_excel_data(xlsx_path, sheet_num=2):
    """Extract survey data from Excel file"""
    data = []
    
    with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
        sheet_path = f'xl/worksheets/sheet{sheet_num}.xml'
        try:
            sheet_xml = zip_ref.read(sheet_path).decode('utf-8')
        except:
            print(f"Error: Sheet {sheet_num} not found", file=sys.stderr)
            return data
        
        root = ET.fromstring(sheet_xml)
        
        # Extract shared strings
        strings = []
        try:
            strings_xml = zip_ref.read('xl/sharedStrings.xml').decode('utf-8')
            strings_root = ET.fromstring(strings_xml)
            for si in strings_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text_parts = []
                for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                    if t.text:
                        text_parts.append(t.text)
                strings.append(''.join(text_parts))
        except:
            pass
        
        # Parse cells
        rows = []
        for row in root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            row_data = []
            for cell in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                cell_type = cell.get('t', 'n')
                value_elem = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                
                if value_elem is not None and value_elem.text:
                    if cell_type == 's':
                        idx = int(value_elem.text)
                        value = strings[idx] if idx < len(strings) else ''
                    else:
                        try:
                            value = float(value_elem.text)
                        except:
                            value = value_elem.text
                    row_data.append(value)
                else:
                    row_data.append('')
            
            if any(row_data):
                rows.append(row_data)
        
        # Convert to dict format
        if len(rows) > 1:
            headers = rows[0]
            for row in rows[1:]:
                entry = {}
                for i, header in enumerate(headers):
                    if isinstance(header, str):
                        header = header.strip()
                    entry[header] = row[i] if i < len(row) else ''
                if any(entry.values()):
                    data.append(entry)
    
    return data

def build_survey_map(survey_data):
    """Build lookup maps for survey data"""
    by_display_name = {}
    by_surname_seat = {}
    
    for entry in survey_data:
        name = entry.get('Name', '')
        if not name:
            continue
        
        # By exact name
        name_key = normalize_text(name)
        if name_key:
            by_display_name[name_key] = entry
        
        # By surname + constituency
        surname = extract_surname(name)
        
        # Current parliament constituency
        const_name = entry.get('Constituency (2024- parliament)', '')
        if surname and const_name:
            const_key = normalize_text(const_name)
            by_surname_seat[f'{surname}|{const_key}'] = entry
        
        # Old parliament constituency (fallback)
        const_name_old = entry.get('Constituency (2019-2024 parliament)', '')
        if surname and const_name_old:
            const_key_old = normalize_text(const_name_old)
            by_surname_seat[f'{surname}|{const_key_old}'] = entry
    
    return by_display_name, by_surname_seat

def find_survey_entry(member, by_display_name, by_surname_seat):
    """Find survey entry for a member"""
    # Try exact name match
    exact_match = by_display_name.get(normalize_text(member['name']))
    if exact_match:
        return exact_match
    
    # Try surname + membership constituency
    surname = extract_surname(member['name'])
    seat_name = member.get('membershipFrom', '')
    if surname and seat_name:
        seat_key = normalize_text(seat_name)
        match = by_surname_seat.get(f'{surname}|{seat_key}')
        if match:
            return match
    
    return None

def enrich_member(member, by_display_name, by_surname_seat):
    """Add survey scores to a member"""
    survey_entry = find_survey_entry(member, by_display_name, by_surname_seat)
    
    if survey_entry:
        value = survey_entry.get('Value')
        value_float = float(value) if value else None
        # Get constituency code from current parliament (2024) or fallback to 2019
        const_code = survey_entry.get('Constituency code (2024- parliament)', '') or survey_entry.get('Constituency code (2019-2024 parliament)', '')
        
        return {
            **member,
            'value': value_float,  # 0-100 left-right score
            'value_lo': float(survey_entry.get('Could be as low as', 0)) or None,
            'value_hi': float(survey_entry.get('Could be as high as', 100)) or None,
            # For compatibility with old code
            'econ_mean': value_float,
            'cult_mean': value_float,
            'constituencyCode': const_code
        }
    else:
        return {
            **member,
            'value': None,
            'value_lo': None,
            'value_hi': None,
            'econ_mean': None,
            'cult_mean': None,
            'constituencyCode': None
        }

def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    snapshot_path = project_root / 'data' / 'members-snapshot.json'
    
    print(f'Loading snapshot from {snapshot_path}...', file=sys.stderr)
    snapshot = json.loads(snapshot_path.read_text())
    members = snapshot.get('members', [])
    print(f'Found {len(members)} members', file=sys.stderr)
    
    # Extract Excel data
    print('Extracting survey data from Excel...', file=sys.stderr)
    survey_data = extract_excel_data('/tmp/survey.xlsx', sheet_num=2)
    print(f'Loaded {len(survey_data)} survey entries', file=sys.stderr)
    
    # Build lookup maps
    by_display_name, by_surname_seat = build_survey_map(survey_data)
    print(f'Built maps: {len(by_display_name)} by name, {len(by_surname_seat)} by surname+seat', file=sys.stderr)
    
    # Enrich members
    print('Enriching members with survey scores...', file=sys.stderr)
    enriched = [enrich_member(m, by_display_name, by_surname_seat) for m in members]
    
    # Count enriched
    with_scores = sum(1 for m in enriched if m.get('value') is not None)
    print(f'Enriched {with_scores} of {len(enriched)} members with scores', file=sys.stderr)
    
    # Verify target MPs
    print('\nTarget MPs:', file=sys.stderr)
    for name in ['Josh Babarinde', 'Jade Botterill', 'Helena Dollimore']:
        member = next((m for m in enriched if m['name'] == name), None)
        if member:
            print(f"  {name}: value={member.get('value')}", file=sys.stderr)
    
    # Save enriched snapshot
    enriched_snapshot = {
        'generatedAt': __import__('datetime').datetime.now(
__import__('datetime').timezone.utc).isoformat(),
        'members': enriched
    }
    
    snapshot_path.write_text(json.dumps(enriched_snapshot, indent=2))
    print(f'\nSaved enriched snapshot to {snapshot_path}', file=sys.stderr)

if __name__ == '__main__':
    main()
