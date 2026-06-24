import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { fetchAllParliamentMembers } from './api.js';
import { CABINET_ROLES } from './roles.js';

let draggedMember = null;
let draggedSource = null;

const TOUCH_DROP_TARGET_CLASS = 'touch-drop-target';
let touchAssignHandler = null;
const touchDragState = {
  active: false,
  pointerId: null,
  ghost: null,
  targetRoleKey: null
};

function setTouchAssignHandler(handler) {
  touchAssignHandler = handler;
}

function clearTouchDropTarget() {
  if (!touchDragState.targetRoleKey) return;
  const target = document.querySelector(
    `.cabinet-card[data-role-key="${CSS.escape(touchDragState.targetRoleKey)}"]`
  );
  if (target) target.classList.remove(TOUCH_DROP_TARGET_CLASS);
  touchDragState.targetRoleKey = null;
}

function removeTouchGhost() {
  if (touchDragState.ghost) {
    touchDragState.ghost.remove();
    touchDragState.ghost = null;
  }
}

function endTouchDrag() {
  window.removeEventListener('pointermove', onTouchDragMove);
  window.removeEventListener('pointerup', onTouchDragEnd);
  window.removeEventListener('pointercancel', onTouchDragCancel);
  clearTouchDropTarget();
  removeTouchGhost();
  touchDragState.active = false;
  touchDragState.pointerId = null;
  draggedMember = null;
  draggedSource = null;
}

function updateTouchGhostPosition(clientX, clientY) {
  if (!touchDragState.ghost) return;
  touchDragState.ghost.style.left = `${clientX + 12}px`;
  touchDragState.ghost.style.top = `${clientY + 12}px`;
}

function updateTouchDropTarget(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const card = el?.closest('.cabinet-card[data-role-key]') || null;
  const nextRoleKey = card?.dataset.roleKey || null;

  if (touchDragState.targetRoleKey === nextRoleKey) return;

  clearTouchDropTarget();

  if (card && nextRoleKey) {
    card.classList.add(TOUCH_DROP_TARGET_CLASS);
    touchDragState.targetRoleKey = nextRoleKey;
  }
}

function onTouchDragMove(event) {
  if (!touchDragState.active || event.pointerId !== touchDragState.pointerId) return;
  event.preventDefault();
  updateTouchGhostPosition(event.clientX, event.clientY);
  updateTouchDropTarget(event.clientX, event.clientY);
}

function onTouchDragEnd(event) {
  if (!touchDragState.active || event.pointerId !== touchDragState.pointerId) return;

  updateTouchDropTarget(event.clientX, event.clientY);

  if (touchDragState.targetRoleKey && draggedMember && draggedSource && touchAssignHandler) {
    const role = CABINET_ROLES.find(item => item.role === touchDragState.targetRoleKey);
    if (role) {
      touchAssignHandler({
        role,
        member: draggedMember,
        source: draggedSource,
        duplicate: false
      });
    }
  }

  endTouchDrag();
}

function onTouchDragCancel(event) {
  if (!touchDragState.active || event.pointerId !== touchDragState.pointerId) return;
  endTouchDrag();
}

function startTouchDrag(event, member, source) {
  if (event.pointerType !== 'touch') return;
  event.preventDefault();

  endTouchDrag();

  draggedMember = member;
  draggedSource = source;
  touchDragState.active = true;
  touchDragState.pointerId = event.pointerId;

  const ghost = document.createElement('div');
  ghost.className = 'touch-drag-ghost';
  ghost.textContent = member?.name || 'Member';
  document.body.appendChild(ghost);
  touchDragState.ghost = ghost;

  updateTouchGhostPosition(event.clientX, event.clientY);
  updateTouchDropTarget(event.clientX, event.clientY);

  window.addEventListener('pointermove', onTouchDragMove, { passive: false });
  window.addEventListener('pointerup', onTouchDragEnd, { passive: true });
  window.addEventListener('pointercancel', onTouchDragCancel, { passive: true });
}

// ── Shared Utility Functions ──────────────────────────────────────────────────
function memberLeftRightScore(member) {
  const value = member.value;
  if (value === null || value === undefined) return null;
  const score = parseFloat(value);
  if (Number.isNaN(score)) return null;
  return Math.min(Math.max(score, 0), 100);
}

function constituencyCodeForMember(member) {
  return normalizeText(member.constituencyCode || '');
}

function nationFromCode(code) {
  const firstLetter = (code || '').trim().charAt(0).toUpperCase();
  if (firstLetter === 'E') return 'England';
  if (firstLetter === 'W') return 'Wales';
  if (firstLetter === 'S') return 'Scotland';
  if (firstLetter === 'N') return 'Northern Ireland';
  return 'England';
}

function memberNation(member) {
  return nationFromCode(constituencyCodeForMember(member));
}

// ── MpCard ───────────────────────────────────────────────────────────────────
const MpCard = {
  props: {
    cardTitle:    { type: String,  default: null },
    name:         { type: String,  required: true },
    thumbnailUrl: { type: String,  default: null },
    partyColour:  { type: String,  default: '#cccccc' },
    assigned:     { type: Boolean, default: false }
  },
  computed: {
    portraitStyle() {
      return { borderColor: this.partyColour };
    },
    nameplateStyle() {
      return {
        borderColor:     this.partyColour,
        backgroundColor: this.assigned ? '#000000' : '#ffffff',
        color:           this.assigned ? '#ffffff' : '#000000'
      };
    },
    imgSrc() {
      return this.thumbnailUrl || 'img/silhouette.svg';
    },
    displayName() {
      let rawName = (this.name || '').trim();

      // Remove post-nominals such as KC or CBE before applying display rules.
      rawName = rawName
        .replace(/,\s*[A-Z]{2,}(?:\s*,\s*[A-Z]{2,})*$/g, '')
        .replace(/\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*$/g, '');

      const titleMatch = rawName.match(/^(Baroness|Lord|Lady|The Baroness|The Lord)\b/i);
      if (titleMatch) {
        const title = titleMatch[0].replace(/^The\s+/i, '');
        const rest = rawName.slice(titleMatch[0].length).trim();
        return rest ? `${title} ${rest}` : title;
      }

      const parts = rawName.split(/\s+/);
      if (parts.length < 2 || rawName.length <= 24) return rawName;

      return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
    }
  },
  template: `
    <div class="mp-card">
      <div v-if="cardTitle" class="mp-card-role">{{ cardTitle }}</div>
      <div class="mp-card-portrait" :style="portraitStyle">
        <img :src="imgSrc" :alt="name" draggable="false">
        <slot name="portrait-overlay"></slot>
      </div>
      <div class="mp-card-nameplate" :style="nameplateStyle">
        <span :title="name">{{ displayName }}</span>
      </div>
    </div>
  `
};

// ── CabinetCard ──────────────────────────────────────────────────────────────
const CabinetCard = {
  components: { MpCard },
  props: {
    role:   { type: Object, required: true },
    member: { type: Object, default: null }
  },
  emits: ['assign', 'unassign'],
  data() {
    return { dragOver: false };
  },
  computed: {
    isAssigned() {
      return this.member !== null;
    },
    cardStyle() {
      return {
        gridRow:    this.role.row,
        gridColumn: this.role.col,
        marginTop:  this.role.raised ? '-30px' : '0'
      };
    }
  },
  methods: {
    onDragStart(e) {
      if (!this.isAssigned) return;
      draggedMember = this.member;
      draggedSource = { type: 'cabinet', role: this.role };
      e.dataTransfer.effectAllowed = 'all';
      e.dataTransfer.setDragImage(
        e.currentTarget,
        e.currentTarget.offsetWidth / 2,
        e.currentTarget.offsetHeight / 2
      );
    },
    onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.dragOver = true;
    },
    onDragLeave() {
      this.dragOver = false;
    },
    onDrop(e) {
      e.preventDefault();
      this.dragOver = false;
      if (!draggedMember || !draggedSource) return;
      this.$emit('assign', {
        role:      this.role,
        member:    draggedMember,
        source:    draggedSource,
        duplicate: e.shiftKey
      });
      draggedMember = null;
      draggedSource = null;
    },
    onRemove() {
      this.$emit('unassign', this.role);
    },
    onPointerStartDrag(e) {
      if (!this.isAssigned) return;
      if (e.target.closest('.remove-btn') || e.target.closest('.info-btn')) return;
      if (e.pointerType === 'mouse') return;
      startTouchDrag(e, this.member, { type: 'cabinet', role: this.role });
    },
    initPopover() {
      const btn = this.$el?.querySelector('.info-btn');
      if (!btn || typeof bootstrap === 'undefined') return;
      const existing = bootstrap.Popover.getInstance(btn);
      if (existing) existing.dispose();
      new bootstrap.Popover(btn, { container: 'body', trigger: 'hover focus' });
    }
  },
  mounted()  { this.initPopover(); },
  updated()  { this.initPopover(); },
  template: `
    <div
      class="cabinet-card"
      :class="{ 'drag-over': dragOver }"
      :data-role-key="role.role"
      :style="cardStyle"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop">
      <div
        class="cabinet-card-inner"
        :draggable="isAssigned"
        @pointerdown="onPointerStartDrag"
        @dragstart="onDragStart">
        <mp-card
          :card-title="role.cardTitle"
          :name="isAssigned ? member.name : 'Empty'"
          :thumbnail-url="isAssigned ? member.thumbnailUrl : null"
          :party-colour="isAssigned ? member.partyColour : '#cccccc'"
          :assigned="isAssigned">
          <template #portrait-overlay>
            <button
              v-if="isAssigned"
              class="remove-btn"
              @pointerdown.stop
              @click.stop="onRemove">&#215;</button>
            <button
              class="info-btn"
              @pointerdown.stop
              :data-bs-content="role.description"
              data-bs-toggle="popover"
              data-bs-placement="top"
              data-bs-trigger="hover focus">&#9432;</button>
          </template>
        </mp-card>
      </div>
    </div>
  `
};

// ── CabinetGrid ──────────────────────────────────────────────────────────────
const CabinetGrid = {
  components: { CabinetCard },
  props: {
    roles:       { type: Array,  required: true },
    assignments: { type: Object, required: true },
    narrowTall:  { type: Boolean, default: false }
  },
  emits: ['assign', 'unassign'],
  template: `
    <div class="cabinet-grid" :class="{ 'narrow-tall-layout': narrowTall }">
      <cabinet-card
        v-for="role in roles"
        :key="role.role"
        :role="role"
        :member="assignments[role.role] || null"
        @assign="$emit('assign', $event)"
        @unassign="$emit('unassign', $event)">
      </cabinet-card>
    </div>
  `
};

function normalizeText(value) {
  return (value || '').toString().trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── StatsPanel ────────────────────────────────────────────────────────────────
const StatsPanel = {
  props: {
    assignments:   { type: Object, required: true },
    mobileOpen:    { type: Boolean, default: false },
    mobileView:    { type: Boolean, default: false }
  },
  emits: ['import'],
  data() {
    return {
      open:              false,
      exportText:        '',
      importText:        '',
      importError:       null,
      showLeftRightInfo: false,
      hideInfoTimer:     null,
      infoPopoverPos:    { top: '0px', left: '0px' }
    };
  },
  watch: {
    assignments: {
      handler() {
        this.exportText = '';
      },
      deep: true
    }
  },
  computed: {
    panelIsOpen() {
      return this.mobileView ? this.mobileOpen : this.open;
    },
    mobilePanelStyle() {
      if (!this.mobileView) return null;
      return {
        transform: this.mobileOpen ? 'translateX(0)' : 'translateX(-100%)'
      };
    },
    assignedMembers() {
      const seen = new Set();
      return Object.values(this.assignments).filter(Boolean).filter(member => {
        if (seen.has(member.id)) return false;
        seen.add(member.id);
        return true;
      });
    },
    genderCounts() {
      const counts = { Male: 0, Female: 0, Unknown: 0 };
      this.assignedMembers.forEach(member => {
        const gender = member.gender === 'M' ? 'Male' : member.gender === 'F' ? 'Female' : 'Unknown';
        counts[gender]++;
      });
      return counts;
    },
    partyCounts() {
      const counts = {};
      this.assignedMembers.forEach(member => {
        const party = member.party || 'Unknown';
        counts[party] = (counts[party] || 0) + 1;
      });
      return counts;
    },
    leftRightPoints() {
      return this.assignedMembers.map(member => {
        const score = memberLeftRightScore(member);
        if (score === null) return null;
        return { member, score };
      }).filter(Boolean);
    },
    leftRightScores() {
      return this.leftRightPoints.map(p => p.score);
    },
    leftRightBuckets() {
      const fixedRanges = [
        { label: '0-33.4',    min: 0,    max: 33.499999 },
        { label: '33.5-36.4', min: 33.5, max: 36.499999 },
        { label: '36.5-39.9', min: 36.5, max: 39.999999 },
        { label: '40-44.9',   min: 40,   max: 44.999999 },
        { label: '45-54.9',   min: 45,   max: 54.999999 },
        { label: '55-62.4',   min: 55,   max: 62.499999 },
        { label: '62.5-67.4', min: 62.5, max: 67.499999 },
        { label: '67.5-72.4', min: 67.5, max: 72.499999 },
        { label: '72.5-100',  min: 72.5, max: 100   }
      ];
      const counts = new Array(fixedRanges.length).fill(0);
      this.leftRightScores.forEach(score => {
        fixedRanges.forEach((range, index) => {
          if (score >= range.min && score <= range.max) counts[index]++;
        });
      });
      return fixedRanges.map((range, index) => ({
        label: range.label, count: counts[index], value: index
      }));
    },
    leftRightMaxBucketCount() {
      return Math.max(1, ...this.leftRightBuckets.map(b => b.count));
    },
    nationsCounts() {
      const counts = {};
      this.assignedMembers.forEach(member => {
        const nation = memberNation(member);
        counts[nation] = (counts[nation] || 0) + 1;
      });
      return counts;
    },
    totalAssigned() {
      return this.assignedMembers.length;
    }
  },
  methods: {
    bucketColor(index) {
      const colors = [
        '#8B0000', '#C00000', '#FF4C4C', '#FF99CC', '#FFD700',
        '#4C9BFF', '#5D48FF', '#8A2BE2', '#4B0082', '#000000'
      ];
      return colors[index] || '#2b7cff';
    },
    percent(count) {
      return this.totalAssigned ? Math.round((count / this.totalAssigned) * 100) : 0;
    },
    barStyle(count) {
      const width = this.totalAssigned
        ? Math.max(6, Math.round((count / this.totalAssigned) * 100))
        : 0;
      return { width: width + '%' };
    },
    buildExportText() {
      const parts = Object.entries(this.assignments)
        .filter(([, member]) => member)
        .map(([role, member]) => {
          const index = CABINET_ROLES.findIndex(r => r.role === role);
          if (index === -1) return null;
          return `${index}:${member.id}`;
        })
        .filter(Boolean);
      return parts.join(',');
    },
    exportCabinet() {
      this.exportText = this.buildExportText();
    },
    copyExport() {
      navigator.clipboard.writeText(this.exportText);
    },
    importCabinet() {
      this.importError = null;
      try {
        const pairs = this.importText.trim().split(',');
        const data = pairs.map(pair => {
          const [indexStr, idStr] = pair.split(':');
          const index = parseInt(indexStr);
          const memberId = parseInt(idStr);
          if (isNaN(index) || isNaN(memberId)) throw new Error('Invalid format');
          const role = CABINET_ROLES[index];
          if (!role) throw new Error(`Unknown role index: ${index}`);
          return { role: role.role, memberId };
        });
        this.$emit('import', data);
        this.importText = '';
      } catch (e) {
        this.importError = 'Invalid cabinet data — please check the text and try again.';
      }
    },
    updateInfoPos() {
      const btn = this.$refs.infoBtn;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      this.infoPopoverPos = {
        top:  (rect.bottom + 8) + 'px',
        left: rect.left + 'px'
      };
    },
    onInfoEnter() {
      clearTimeout(this.hideInfoTimer);
      this.updateInfoPos();
      this.showLeftRightInfo = true;
    },
    onInfoLeave() {
      this.hideInfoTimer = setTimeout(() => {
        this.showLeftRightInfo = false;
      }, 300);
    },
    onInfoClick() {
      if (!this.showLeftRightInfo) this.updateInfoPos();
      this.showLeftRightInfo = !this.showLeftRightInfo;
      clearTimeout(this.hideInfoTimer);
    }
  },
  template: `
    <div class="stats-panel" :class="{ open: panelIsOpen, 'mobile-open': mobileView && mobileOpen }" :style="mobilePanelStyle">
      <button v-if="!mobileView" class="stats-panel-toggle" @click="open = !open" :aria-expanded="panelIsOpen">
        <span class="stats-panel-toggle-icon" :class="{ open }">&#x25B6;</span>
      </button>
      <div class="stats-panel-body">

        <div class="stats-panel-header">
          <h2>Statistics</h2>
        </div>

        <div class="stats-section">
          <h3>Gender balance</h3>
          <div class="gender-line">
            <span>Female: {{ genderCounts['Female'] }} ({{ percent(genderCounts['Female']) }}%)</span>
            <span>Male: {{ genderCounts['Male'] }} ({{ percent(genderCounts['Male']) }}%)</span>
          </div>
        </div>

        <div class="stats-section">
          <h3>Party balance</h3>
          <div v-if="Object.keys(partyCounts).length">
            <div
              class="stat-row"
              v-for="party in Object.keys(partyCounts).sort((a,b) => partyCounts[b] - partyCounts[a])"
              :key="party">
              <span class="stat-label">{{ party }}</span>
              <div class="stat-bar">
                <div class="stat-fill" :style="barStyle(partyCounts[party])"></div>
              </div>
              <span class="stat-value">{{ partyCounts[party] }} ({{ percent(partyCounts[party]) }}%)</span>
            </div>
          </div>
          <div v-else class="stats-empty">No party data available</div>
        </div>

        <div class="stats-section">
          <h3>
            Political spectrum
            <span class="info-popover-wrapper">
              <button
                ref="infoBtn"
                type="button"
                class="info-icon"
                @mouseenter="onInfoEnter"
                @mouseleave="onInfoLeave"
                @click="onInfoClick"
                aria-label="More information about the left-right scale">ℹ</button>
            </span>
          </h3>
          <teleport to="body">
            <div
              v-if="showLeftRightInfo"
              class="info-popover"
              :style="{ position: 'fixed', top: infoPopoverPos.top, left: infoPopoverPos.left, zIndex: 9999 }"
              @mouseenter="onInfoEnter"
              @mouseleave="onInfoLeave">
              <p>MP left-right position is based on data from Survation, UK in a Changing Europe and Royal Holloway, University of London, available at <a href="https://www.mpsleftright.co.uk/" target="_blank" rel="noopener">mpsleftright.co.uk</a>. Figures are based on survey data and may not accurately reflect MP views.</p>
              <p>Values have been translated to a nine-point scale for the purpose of visualising MP spread.</p>
            </div>
          </teleport>
          <div v-if="leftRightPoints.length">
            <div class="lr-histogram">
              <div
                v-for="bucket in leftRightBuckets"
                :key="bucket.label"
                class="lr-bar"
                :style="{
                  height: (bucket.count / leftRightMaxBucketCount * 100) + '%',
                  backgroundColor: bucketColor(bucket.value)
                }"
                :title="bucket.label + ': ' + bucket.count">
                <span v-if="bucket.count > 0">{{ bucket.count }}</span>
              </div>
            </div>
            <div class="lr-labels">
              <div class="lr-label left">Left</div>
              <div class="lr-label right">Right</div>
            </div>
          </div>
          <div v-else class="stats-empty">
            No political spectrum data available
          </div>
        </div>

        <div class="stats-panel-header">
          <h2>Import / Export</h2>
        </div>

        <div class="stats-section">
          <h3>Export cabinet</h3>
          <button class="stats-btn" @click="exportCabinet">Generate export text</button>
          <div v-if="exportText">
            <textarea class="cabinet-text" readonly :value="exportText" rows="3"></textarea>
            <button class="stats-btn" @click="copyExport">Copy to clipboard</button>
          </div>
        </div>

        <div class="stats-section">
          <h3>Import cabinet</h3>
          <textarea
            class="cabinet-text"
            v-model="importText"
            placeholder="Paste cabinet text here..."
            rows="3">
          </textarea>
          <button class="stats-btn" @click="importCabinet">Import</button>
          <div v-if="importError" class="stats-error">{{ importError }}</div>
        </div>

      </div>
    </div>
  `
};

// ── MpPool ───────────────────────────────────────────────────────────────────
const MpPool = {
  components: { MpCard },
  props: {
    members:    { type: Array,   required: true },
    loading:    { type: Boolean, default: false }
  },
  data() {
    return {
      filters: {
        house:     'Commons',
        name:      '',
        party:     'all',
        gender:    'all',
        nation:    'all',
        leftRight: 'all'
      }
    };
  },
  computed: {
    isLordsHouse() {
      return this.filters.house === 'Lords';
    },
    parties() {
      const houseMembers = this.members.filter(m => m.house === this.filters.house);
      return [...new Set(houseMembers.map(m => this.normalizePartyValue(m.party)))].sort();
    },
    leftRightFilterOptions() {
      return [
        { label: 'Unclassified',            min: null, max: null },
        { label: '1 - most left-wing',     min: 0,    max: 33.499999 },
        { label: '2 - very left-wing',      min: 33.5, max: 36.499999 },
        { label: '3 - fairly left-wing',    min: 36.5, max: 39.999999 },
        { label: '4 - slightly left-wing',  min: 40,   max: 44.999999 },
        { label: '5 - centre',              min: 45,   max: 54.999999 },
        { label: '6 - slightly right-wing', min: 55,   max: 62.499999 },
        { label: '7 - fairly right-wing',   min: 62.5, max: 67.499999 },
        { label: '8 - very right-wing',     min: 67.5, max: 72.499999 },
        { label: '9 - most right-wing',     min: 72.5, max: 100   }
      ];
    },
    filteredMembers() {
      return this.members.filter(m => {
        const normalizedParty = this.normalizePartyValue(m.party);
        if (m.house !== this.filters.house) return false;
        if (this.filters.name &&
            !m.name.toLowerCase().includes(this.filters.name.toLowerCase())) return false;
        if (this.filters.party !== 'all' && normalizedParty !== this.filters.party) return false;
        if (this.filters.gender !== 'all' && this.memberGender(m) !== this.filters.gender) return false;
        if (this.filters.nation !== 'all' && memberNation(m) !== this.filters.nation) return false;
        if (this.filters.leftRight !== 'all' &&
            this.memberLeftRightBucket(m) !== this.filters.leftRight) return false;
        return true;
      });
    }
  },
  watch: {
    'filters.house'(newHouse) {
      this.filters.party = 'all';
      if (newHouse === 'Lords') {
        this.filters.nation = 'all';
        this.filters.leftRight = 'all';
      }
    }
  },
  methods: {
    normalizePartyValue(party) {
      const value = (party || '').trim();
      if (/^Labour\b/i.test(value) && /Co(?:-|\s*)?op(?:erative)?/i.test(value)) return 'Labour';
      return value;
    },
    memberGender(member) {
      if (member.gender === 'M') return 'M';
      if (member.gender === 'F') return 'F';
      return 'Other';
    },
    memberLeftRightBucket(member) {
      const score = memberLeftRightScore(member);
      if (score === null) return 'Unclassified';
      const range = this.leftRightFilterOptions.find(r => r.min !== null && score >= r.min && score <= r.max);
      return range ? range.label : 'Unclassified';
    },
    onDragStart(e, member) {
      draggedMember = member;
      draggedSource = { type: 'pool' };
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setDragImage(
        e.currentTarget,
        e.currentTarget.offsetWidth / 2,
        e.currentTarget.offsetHeight / 2
      );
    },
    onPointerStart(e, member) {
      startTouchDrag(e, member, { type: 'pool' });
    }
  },
  template: `
    <div class="pool-section">
      <div class="pool-filters">
        <select v-model="filters.house">
          <option value="Commons">House of Commons</option>
          <option value="Lords">House of Lords</option>
        </select>
        <input v-model="filters.name" type="text" placeholder="Search by name...">
        <select v-model="filters.party">
          <option value="all">All parties</option>
          <option v-for="party in parties" :key="party" :value="party">{{ party }}</option>
        </select>
        <select v-model="filters.gender">
          <option value="all">All genders</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>
        <select v-model="filters.nation" :disabled="isLordsHouse">
          <option value="all">All nations</option>
          <option value="England">England</option>
          <option value="Wales">Wales</option>
          <option value="Scotland">Scotland</option>
          <option value="Northern Ireland">Northern Ireland</option>
        </select>
        <select
          v-model="filters.leftRight"
          :disabled="isLordsHouse"
          aria-label="Filter MPs by left-right position">
          <option value="all">Full political spectrum</option>
          <option
            v-for="option in leftRightFilterOptions"
            :key="option.label"
            :value="option.label">{{ option.label }}</option>
        </select>
      </div>
      <div v-if="loading" class="pool-loading">Loading members...</div>
      <div v-else class="pool-grid">
        <div
          v-for="member in filteredMembers"
          :key="member.id"
          class="pool-card"
          draggable="true"
          @pointerdown="onPointerStart($event, member)"
          @dragstart="onDragStart($event, member)">
          <mp-card
            :name="member.name"
            :thumbnail-url="member.thumbnailUrl"
            :party-colour="member.partyColour"
            :assigned="false">
          </mp-card>
        </div>
      </div>
    </div>
  `
};

// ── Main App ──────────────────────────────────────────────────────────────────
createApp({
  components: { CabinetGrid, MpPool, StatsPanel },
  constants: {
    NARROW_TALL_ROLE_LAYOUT: {
      'Chancellor of the Duchy of Lancaster': { row: 1, col: 2, raised: false },
      'Prime Minister': { row: 1, col: 3, raised: true },
      'Deputy Prime Minister': { row: 1, col: 4, raised: false },
      'Leader of the House of Commons': { row: 2, col: 1, raised: false },
      'Foreign Secretary': { row: 2, col: 2, raised: false },
      'Chancellor of the Exchequer': { row: 2, col: 3, raised: false },
      'Home Secretary': { row: 2, col: 4, raised: false },
      'Leader of the House of Lords': { row: 2, col: 5, raised: false },
      'Secretary of State for Health and Social Care': { row: 3, col: 1, raised: false },
      'Secretary of State for Northern Ireland': { row: 3, col: 2, raised: false },
      'Secretary of State for Scotland': { row: 3, col: 3, raised: false },
      'Secretary of State for Wales': { row: 3, col: 4, raised: false },
      'Secretary of State for Education': { row: 3, col: 5, raised: false },
      'Secretary of State for Energy Security and Net Zero': { row: 4, col: 1, raised: false },
      'Secretary of State for Defence': { row: 4, col: 2, raised: false },
      'Secretary of State for Justice': { row: 4, col: 3, raised: false },
      'Attorney General': { row: 4, col: 4, raised: false },
      'Secretary of State for Environment, Food and Rural Affairs': { row: 4, col: 5, raised: false },
      'Secretary of State for Housing, Communities and Local Government': { row: 5, col: 1, raised: false },
      'Secretary of State for Transport': { row: 5, col: 2, raised: false },
      'Secretary of State for Work and Pensions': { row: 5, col: 3, raised: false },
      'Secretary of State for Business and Trade': { row: 5, col: 4, raised: false },
      'Minister for International Development': { row: 5, col: 5, raised: false },
      'Secretary of State for Culture, Media and Sport': { row: 6, col: 1, raised: false },
      'Secretary of State for Science, Innovation and Technology': { row: 6, col: 2, raised: false },
      'Chief Secretary to the Treasury': { row: 6, col: 3, raised: false },
      'Minister for Women and Equalities': { row: 6, col: 4, raised: false },
      'Minister for the Cabinet Office': { row: 6, col: 5, raised: false },
      'Chief Whip': { row: 7, col: 1, raised: false }, 
      'Minister without portfolio': { row: 7, col: 3, raised: false }
     
      
    }
  },
  data() {
    return {
      roles:            CABINET_ROLES,
      members:          [],
      loading:          true,
      error:            null,
      assignments:      {},
      theme:            'light',
      cabinetZoom:      1,
      isMobileView:     false,
      isNarrowTallView: false,
      mobileStatsOpen:  false,
      mobilePoolMode:   'max',
      pinchPointers:    {},
      pinchStartZoom:   1,
      pinchStartDist:   0,
      poolHeight:       260,
      resizing:         false,
      startY:           0,
      startHeight:      0,
      resizeHandler:    null,
      mouseMoveHandler: null,
      mouseUpHandler:   null,
      headerHeightPx:   56
    };
  },
  computed: {
    displayRoles() {
      if (!this.isNarrowTallView) return this.roles;
      const layout = this.$options.constants.NARROW_TALL_ROLE_LAYOUT;
      return this.roles.map(role => {
        const override = layout[role.role];
        if (!override) return role;
        return {
          ...role,
          row: override.row,
          col: override.col,
          raised: override.raised ?? false
        };
      });
    },
    cabinetZoomStyle() {
      return { '--cabinet-zoom': this.cabinetZoom.toFixed(2) };
    },
    poolPanelClass() {
      return {
        minimized: this.isMobileView && this.mobilePoolMode === 'min'
      };
    },
    poolPanelStyle() {
      if (this.isMobileView) {
        const mobileHeight = this.mobilePoolMode === 'min' ? '56px' : '50vh';
        return { height: mobileHeight };
      }
      return { height: this.poolHeight + 'px' };
    },
    mobileStatsArrow() {
      return '▼';
    },
    mobilePoolArrow() {
      return '▼';
    }
  },
  async mounted() {
    this.theme = localStorage.getItem('cabinet-builder-theme') ||
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = this.theme;

    this.resizeHandler = () => {
      const wasMobile = this.isMobileView;
      this.isMobileView = window.matchMedia?.('(max-width: 900px)').matches ?? false;
      this.updateHeaderHeightVar();
      const width = window.innerWidth || 0;
      const height = window.innerHeight || 0;
      const aspect = width ? (height / width) : 0;
      this.isNarrowTallView = width <= 700 && aspect >= 1.45;

      if (this.isMobileView && !wasMobile) {
        this.mobilePoolMode = 'max';
      }
      if (!this.isMobileView && wasMobile) {
        this.mobileStatsOpen = false;
      }
    };
    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler, { passive: true });

    const storedZoom = Number(localStorage.getItem('cabinet-builder-cabinet-zoom'));
    if (Number.isFinite(storedZoom) && storedZoom >= 0.7 && storedZoom <= 2.2) {
      this.cabinetZoom = storedZoom;
    } else if (this.isMobileView) {
      this.cabinetZoom = 1.35;
      this.poolHeight = 180;
    }

    setTouchAssignHandler(payload => this.handleAssign(payload));

    try {
      this.members = await fetchAllParliamentMembers();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  },
  beforeUnmount() {
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    setTouchAssignHandler(null);
    endTouchDrag();
  },
  watch: {
    theme(newTheme) {
      document.documentElement.dataset.theme = newTheme;
      localStorage.setItem('cabinet-builder-theme', newTheme);
    },
    cabinetZoom(newZoom) {
      localStorage.setItem('cabinet-builder-cabinet-zoom', String(newZoom));
    }
  },
  methods: {
    updateHeaderHeightVar() {
      const header = document.querySelector('.app-header');
      const height = Math.round(header?.getBoundingClientRect().height || 56);
      this.headerHeightPx = height;
      document.documentElement.style.setProperty('--app-header-height', `${height}px`);
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
    },
    clearCabinet() {
      this.assignments = {};
    },
    toggleMobileStats() {
      if (!this.isMobileView) return;
      this.mobileStatsOpen = !this.mobileStatsOpen;
    },
    toggleMobilePool() {
      if (!this.isMobileView) return;
      this.mobilePoolMode = this.mobilePoolMode === 'min' ? 'max' : 'min';
    },
    clampCabinetZoom(value) {
      return Math.min(2.2, Math.max(0.7, Math.round(value * 100) / 100));
    },
    applyZoomAtPoint(nextZoom, clientX, clientY) {
      const viewport = this.$refs.cabinetViewport;
      const oldZoom = this.cabinetZoom;
      const clamped = this.clampCabinetZoom(nextZoom);
      if (!viewport || clamped === oldZoom) {
        this.cabinetZoom = clamped;
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const focalX = clientX - rect.left;
      const focalY = clientY - rect.top;
      const contentX = (viewport.scrollLeft + focalX) / oldZoom;
      const contentY = (viewport.scrollTop + focalY) / oldZoom;

      this.cabinetZoom = clamped;

      this.$nextTick(() => {
        viewport.scrollLeft = (contentX * clamped) - focalX;
        viewport.scrollTop = (contentY * clamped) - focalY;
      });
    },
    onCabinetWheel(event) {
      const delta = -event.deltaY;
      const sensitivity = event.ctrlKey ? 0.0016 : 0.0005;
      this.applyZoomAtPoint(
        this.cabinetZoom + (delta * sensitivity),
        event.clientX,
        event.clientY
      );
    },
    onCabinetPointerDown(event) {
      if (event.pointerType !== 'touch') return;
      this.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      const points = Object.values(this.pinchPointers);
      if (points.length === 2) {
        this.pinchStartDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        this.pinchStartZoom = this.cabinetZoom;
      }
    },
    onCabinetPointerMove(event) {
      if (event.pointerType !== 'touch') return;
      if (!(event.pointerId in this.pinchPointers)) return;
      this.pinchPointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      const points = Object.values(this.pinchPointers);
      if (points.length !== 2 || this.pinchStartDist <= 0) return;
      const currentDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (!currentDist) return;
      const scale = currentDist / this.pinchStartDist;
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      this.applyZoomAtPoint(this.pinchStartZoom * scale, centerX, centerY);
      event.preventDefault();
    },
    onCabinetPointerEnd(event) {
      if (event.pointerType !== 'touch') return;
      delete this.pinchPointers[event.pointerId];
      if (Object.keys(this.pinchPointers).length < 2) {
        this.pinchStartDist = 0;
        this.pinchStartZoom = this.cabinetZoom;
      }
    },
    handleAssign({ role, member, source, duplicate }) {
      const newAssignments = { ...this.assignments };
      if (source?.type === 'cabinet' && source.role?.role &&
          source.role.role !== role.role && !duplicate) {
        delete newAssignments[source.role.role];
      }
      newAssignments[role.role] = member;
      this.assignments = newAssignments;
    },
    handleUnassign(role) {
      const newAssignments = { ...this.assignments };
      delete newAssignments[role.role];
      this.assignments = newAssignments;
    },
    handleImport(data) {
      const newAssignments = {};
      data.forEach(({ role, memberId }) => {
        const member = this.members.find(m => m.id === memberId);
        if (member) newAssignments[role] = member;
      });
      this.assignments = newAssignments;
    },
    startResize(e) {
      this.resizing = true;
      this.startY = e.clientY;
      this.startHeight = this.poolHeight;
      this.mouseMoveHandler = event => this.resizePool(event);
      this.mouseUpHandler = () => this.stopResize();
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', this.mouseMoveHandler);
      document.addEventListener('mouseup', this.mouseUpHandler);
      e.preventDefault();
    },
    resizePool(event) {
      if (!this.resizing) return;
      const delta = this.startY - event.clientY;
      const minHeight = 48;
      const mainEl = document.querySelector('main');
      const maxHeight = mainEl ? mainEl.clientHeight - 8 : window.innerHeight - 90;
      this.poolHeight = Math.min(Math.max(this.startHeight + delta, minHeight), maxHeight);
    },
    stopResize() {
      if (!this.resizing) return;
      this.resizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (this.mouseMoveHandler) document.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.mouseUpHandler) document.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseMoveHandler = null;
      this.mouseUpHandler = null;
    }
  },
  template: `
    <div :data-theme="theme">
      <header class="app-header">
        <h1>Cabinet builder</h1>
        <div class="header-actions">
          <button type="button" class="theme-toggle" @click="clearCabinet">
            <span>Clear cabinet</span>
          </button>
          <button
            type="button"
            class="theme-toggle"
            :aria-pressed="theme === 'dark'"
            @click="toggleTheme">
            <span aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span>
            <span>{{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
          </button>
        </div>
      </header>
      <main ref="main">
        <button
          v-if="isMobileView"
          type="button"
          class="mobile-stats-toggle"
          :class="{ 'is-open': mobileStatsOpen }"
          :aria-pressed="mobileStatsOpen"
          :aria-label="mobileStatsOpen ? 'Close statistics panel' : 'Open statistics panel'"
          @click="toggleMobileStats"><span class="mobile-toggle-arrow">{{ mobileStatsArrow }}</span></button>
        <stats-panel
          :assignments="assignments"
          :mobile-open="mobileStatsOpen"
          :mobile-view="isMobileView"
          @import="handleImport">
        </stats-panel>
        <div class="app-content">
          <div v-if="error" class="error-msg" role="alert" aria-live="assertive">{{ error }}</div>
          <div class="split-panel">
            <div class="cabinet-panel">
              <div
                class="cabinet-viewport"
                ref="cabinetViewport"
                @wheel.prevent="onCabinetWheel"
                @pointerdown="onCabinetPointerDown"
                @pointermove="onCabinetPointerMove"
                @pointerup="onCabinetPointerEnd"
                @pointercancel="onCabinetPointerEnd">
                <div class="cabinet-zoom-stage" :style="cabinetZoomStyle">
                  <cabinet-grid
                    :roles="displayRoles"
                    :narrow-tall="isNarrowTallView"
                    :assignments="assignments"
                    @assign="handleAssign"
                    @unassign="handleUnassign">
                  </cabinet-grid>
                </div>
              </div>
            </div>
            <div class="panel-resizer" @mousedown="startResize"></div>
            <div class="pool-panel" :class="poolPanelClass" :style="poolPanelStyle">
              <div v-if="isMobileView" class="mobile-pool-toolbar">
                <button
                  type="button"
                  class="mobile-pool-toggle"
                  :class="{ 'is-min': mobilePoolMode === 'min' }"
                  :aria-pressed="mobilePoolMode === 'max'"
                  :aria-label="mobilePoolMode === 'min' ? 'Maximise pool panel' : 'Minimise pool panel'"
                  @click="toggleMobilePool"><span class="mobile-toggle-arrow">{{ mobilePoolArrow }}</span></button>
              </div>
              <div class="pool-panel-content">
                <mp-pool
                  :members="members"
                  :loading="loading">
                </mp-pool>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `
}).mount('#app');