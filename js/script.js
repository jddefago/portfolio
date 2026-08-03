document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('main section[id]');
  const heroEl = document.getElementById('hero');
  const projectsFadeEls = document.querySelectorAll('.projects-title, .projects-divider, .projects-subtitle');
  const experienceEl = document.getElementById('experience');
  const skillsEl = document.getElementById('skills');
  const forestPinTrack = document.getElementById('forestPinTrack');
  const forestPinStage = document.querySelector('.forest-pin-stage');
  const rootStyle = document.documentElement.style;

  // Fraction of forestPinTrack's total scrollable distance spent paused at
  // each end, before/after the active pan — the pin holds on Experience at
  // rest for a beat once it's reached, then again holds on Skills at rest
  // once the pan finishes, rather than starting to shift the moment the pin
  // engages or releasing the instant the pan completes.
  const FOREST_PAUSE_FRACTION = 0.15;
  let forestPinProgress = 0;
  // Set once initProjectIslands() runs (below) — reads forestPinProgress in
  // onScroll to auto-close the experience note once the pin's past its
  // midpoint, since that note's own open/close state lives inside that
  // function's closure and has no other way to reach this one.
  let closeExperienceDescription = null;
  // Same idea, the other direction — set once initSkillsShowcase() runs,
  // used to retract an open skill category's pills once scrolling back
  // toward Experience passes the pin's midpoint.
  let closeSkillsPills = null;

  // Real aspect ratio of the forest background, once it's loaded — used to
  // work out exactly how many pixels the background itself pans by (see
  // forestPanOffsetPx in onScroll), so Experience's signpost and title can
  // be offset by that same amount and stay glued to a fixed spot in the
  // scene instead of sitting still while the ground pans under them. 3.46
  // is the documented approximation (style.css), used only for the first
  // frame or two before the probe image reports its real size.
  let forestBgAspect = 3.46;
  const forestBgProbe = new Image();
  forestBgProbe.addEventListener('load', () => {
    forestBgAspect = forestBgProbe.naturalWidth / forestBgProbe.naturalHeight;
    onScroll();
  });
  forestBgProbe.src = 'media/forest background.png';

  function onScroll() {
    const scrollY = window.scrollY;

    header.classList.toggle('scrolled', scrollY > 40);

    const heroBottom = heroEl.offsetTop + heroEl.offsetHeight;
    const pastHero = scrollY + header.offsetHeight * 0.6 > heroBottom;

    // .site-header has no background (it's meant to stay transparent over
    // the hero art), so anything that scrolls up behind it stays visible —
    // each element's fade has to finish well before it reaches the header's
    // zone, not just before it crosses the very top of the viewport. Each
    // one is checked independently so they fade in the natural scroll order
    // (title first, then divider, then subtitle).
    projectsFadeEls.forEach((el) => {
      const scrolledPast = el.getBoundingClientRect().bottom < header.offsetHeight + 80;
      el.classList.toggle('is-scrolled-past', scrolledPast);
    });

    // Forest pin: forestPinTrack reserves 100vh for the pinned viewport plus
    // --forest-pin-duration of extra scroll distance, and forest-pin-stage
    // (position: sticky) stays stuck to the top of the viewport for exactly
    // that distance — so scrolling through the track doesn't move Experience
    // or Skills on screen at all, it just advances progress through it. That
    // distance is split into three zones: a pause at 0% (Experience at
    // rest), an active zone where the pan and the Experience→Skills
    // cross-fade both run together, and a pause at 100% (Skills at rest)
    // before the pin releases. forestPinProgress is 0 through the whole
    // first pause, ramps 0→1 only across the active zone, then holds at 1
    // through the second — it drives --forest-pan-x, --layer-opacity, and
    // (via updateActiveSection below) which nav link is active, so all
    // three stay in lockstep.
    const trackTop = forestPinTrack.offsetTop;
    const scrollableDistance = forestPinTrack.offsetHeight - window.innerHeight;
    const pauseDistance = scrollableDistance * FOREST_PAUSE_FRACTION;
    const activeDistance = scrollableDistance - pauseDistance * 2;
    const scrolledIntoTrack = scrollY - trackTop;
    forestPinProgress = activeDistance > 0
      ? Math.min(1, Math.max(0, (scrolledIntoTrack - pauseDistance) / activeDistance))
      : (scrolledIntoTrack >= pauseDistance ? 1 : 0);
    rootStyle.setProperty('--forest-pan-x', (forestPinProgress * 100) + '%');

    // .on-light swaps the header to the gray-on-light scheme for everything
    // past the hero, including scrolling into and resting on Skills — except
    // for one last stretch: the final window.innerHeight of the track is
    // where forest-pin-stage's own sticky positioning runs out and releases
    // (scrollY beyond trackTop + scrollableDistance, i.e. past Skills' own
    // resting point), so the header flips to the hero's white scheme for
    // just that release, then back to on-light the moment scrollY reaches
    // trackBottom and My Story actually begins.
    const trackBottom = trackTop + forestPinTrack.offsetHeight;
    const releaseStart = trackTop + scrollableDistance;
    const inReleaseZone = scrollY >= releaseStart && scrollY < trackBottom;
    header.classList.toggle('on-light', pastHero && !inReleaseZone);

    // Auto-close the experience note once the user's half way from
    // Experience to Skills, rather than leaving it open to fade out with
    // the rest of the layer (see .forest-pin-layer > * in style.css, which
    // now excludes .experience-description from that fade entirely) — it
    // plays its own slide-away instead, same as closing it by hand.
    if (forestPinProgress >= 0.5 && closeExperienceDescription) closeExperienceDescription();
    // Mirror of the above going the other way: scrolling back up past the
    // midpoint retracts an open skill category's pills, same exit as
    // clicking outside them.
    if (forestPinProgress < 0.5 && closeSkillsPills) closeSkillsPills();

    // Mirrors the browser's own background-position-x math for a
    // background wider than its box: at size `auto 107%`, the rendered
    // image is `stage height * 1.07 * forestBgAspect` wide, and panning it
    // from 0%→100% shifts its left edge by (stage width - rendered width)
    // pixels (negative, since the image is wider than the stage). Signpost
    // and title translate by that same pixel amount so they stay pinned to
    // one spot in the scene as it pans, rather than staying screen-fixed.
    const stageWidth = forestPinStage.offsetWidth;
    const stageHeight = forestPinStage.offsetHeight;
    const forestBgRenderedWidth = stageHeight * 1.07 * forestBgAspect;
    const forestPanMaxOffset = stageWidth - forestBgRenderedWidth;
    rootStyle.setProperty('--forest-pan-offset-px', (forestPanMaxOffset * forestPinProgress) + 'px');

    // Skills' content is glued to a spot in the scene the same way, just
    // the mirror image: it's off to the right by the full pan distance at
    // progress 0 (so it arrives from off-screen as the camera pans toward
    // it) and lands at its own authored resting position exactly at
    // progress 1, rather than the signpost/title's un-shifted-at-0 curve.
    rootStyle.setProperty('--forest-pan-offset-skills-px', (forestPanMaxOffset * (forestPinProgress - 1)) + 'px');

    const experienceOpacity = 1 - forestPinProgress;
    const skillsOpacity = forestPinProgress;
    experienceEl.style.setProperty('--layer-opacity', experienceOpacity);
    skillsEl.style.setProperty('--layer-opacity', skillsOpacity);
    experienceEl.classList.toggle('is-inactive-layer', experienceOpacity < 0.02);
    skillsEl.classList.toggle('is-inactive-layer', skillsOpacity < 0.02);

    updateActiveSection();
  }

  // Percentage-of-target IntersectionObserver thresholds don't work once
  // sections vary a lot in height (the Projects section is much taller than
  // Experience, say) — a short section can cross 40% visible easily while a
  // tall one never does, so it never gets marked active. Instead, whichever
  // section's top has scrolled past a fixed reference line (just below the
  // header) is the current one — this works regardless of section height.
  function updateActiveSection() {
    const refY = header.offsetHeight + 20;
    let currentId = sections[0].id;
    sections.forEach((section) => {
      // Experience and Skills are both absolutely stacked inside the same
      // sticky stage while pinned, so they share one on-screen rect —
      // getBoundingClientRect can't tell them apart the way it does for
      // every other section. The Experience slot (in normal DOM order)
      // stands in for the whole pinned scene instead, using pin progress to
      // pick between them; the Skills slot is a no-op since it's already
      // covered there.
      if (section === experienceEl) {
        if (forestPinTrack.getBoundingClientRect().top <= refY) {
          currentId = forestPinProgress < 0.5 ? 'experience' : 'skills';
        }
        return;
      }
      if (section === skillsEl) return;

      if (section.getBoundingClientRect().top <= refY) {
        currentId = section.id;
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === currentId);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    navToggle.classList.toggle('open');
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      mainNav.classList.remove('open');
      navToggle.classList.remove('open');

      // Experience and Skills are both absolutely stacked inside the same
      // sticky stage while pinned (see forestPinTrack), sharing one
      // on-screen rect — the browser's native anchor-jump can't distinguish
      // #experience from #skills there, since scrolling to either target's
      // position lands at the same spot. Both are scrolled to explicitly
      // instead of relying on that: the start of the track for Experience,
      // the end of its scrollable distance (pin progress 1) for Skills.
      if (link.dataset.nav === 'experience' || link.dataset.nav === 'skills') {
        e.preventDefault();
        const scrollableDistance = forestPinTrack.offsetHeight - window.innerHeight;
        const target = link.dataset.nav === 'experience'
          ? forestPinTrack.offsetTop
          : forestPinTrack.offsetTop + scrollableDistance;
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
    });
  });

  initPageLoader();
  closeExperienceDescription = initProjectIslands()?.closeExperienceDescription || null;
  initImageLightbox();
  initGrassParticles();
  initConstructionToggle();
  initRockLizard();
  initContactMenu();
  closeSkillsPills = initSkillsShowcase()?.closeSkillsPills || null;
});

// Header contact menu: clicking the icon or the "Contact" label (one
// <button>, #contactTrigger — see index.html) pops open a small card with
// LinkedIn, email, and CV links (see .contact-popover's staggered pop-in,
// style.css). Same click-to-open/click-outside-to-close pattern used
// elsewhere on the page (signpost hitzones, project islands, skills props).
const CONTACT_EMAIL = 'juandiego.defago@gmail.com';

// Wires an email-copy button to its own nearby toast — shared by the
// header's contact popover and the footer's icon row (see initContactMenu
// below) rather than duplicating the copy-to-clipboard logic for each.
// onCopied, if given, runs right after the copy (the header's instance
// uses it to close the popover; the footer's has nothing extra to do).
function wireEmailCopy(btn, toast, onCopied) {
  if (!btn || !toast) return;
  const TOAST_DURATION = 2200; // ms
  let toastTimer = null;

  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(CONTACT_EMAIL).catch(() => {});
    if (onCopied) onCopied();
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_DURATION);
  });
}

// Keeps the loader up for a short minimum stretch (so it reads as an
// intentional animation rather than a flash) even when the page — which is
// mostly small illustrations — finishes loading almost instantly, then
// fades it out once window 'load' fires and that minimum has elapsed.
function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;

  const MIN_VISIBLE_MS = 400;
  const shownAt = Date.now();

  function hide() {
    const elapsed = Date.now() - shownAt;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    setTimeout(() => {
      loader.classList.add('is-hidden');
      loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    }, wait);
  }

  if (document.readyState === 'complete') {
    hide();
  } else {
    window.addEventListener('load', hide, { once: true });
  }
}

function initContactMenu() {
  const trigger = document.getElementById('contactTrigger');
  const popover = document.getElementById('contactPopover');
  if (!trigger || !popover) return;

  function setOpen(open) {
    popover.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  }

  function isOpen() {
    return popover.classList.contains('is-open');
  }

  trigger.addEventListener('click', () => {
    setOpen(!isOpen());
  });

  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (trigger.contains(e.target) || popover.contains(e.target)) return;
    setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  wireEmailCopy(document.getElementById('contactEmailBtn'), document.getElementById('contactToast'), () => setOpen(false));
  wireEmailCopy(document.getElementById('footerEmailBtn'), document.getElementById('footerContactToast'));

  const reachOut = document.getElementById('footerReachOut');
  const footerIcons = document.querySelector('.footer-contact-icons');
  const reachArrow = document.getElementById('footerReachArrow');
  const reachArrowSrc = reachArrow ? reachArrow.src : null;
  if (reachOut && footerIcons) {
    const POP_DELAY = 700; // ms — lets the arrow gif land first before the icons react to it
    const POP_DURATION = 520; // ms — longest icon's delay (0.12s) + its animation (0.4s), plus a hair of margin
    const ARROW_DURATION = 4710; // ms — one full playthrough of arrow animation.gif's 37 frames (measured from its own frame delays), so it hides right as the loop would otherwise restart
    let popStartTimer = null;
    let popEndTimer = null;
    let arrowTimer = null;
    reachOut.addEventListener('click', () => {
      clearTimeout(popStartTimer);
      clearTimeout(popEndTimer);
      footerIcons.classList.remove('is-popping');
      popStartTimer = setTimeout(() => {
        void footerIcons.offsetWidth; // forces a reflow so re-adding below restarts the animation on repeat clicks
        footerIcons.classList.add('is-popping');
        popEndTimer = setTimeout(() => footerIcons.classList.remove('is-popping'), POP_DURATION);
      }, POP_DELAY);

      if (reachArrow) {
        // Re-assigning src (cache-busted so the browser actually reloads it)
        // restarts the GIF from its first frame instead of continuing
        // wherever its loop happened to be when this click landed.
        reachArrow.src = reachArrowSrc + (reachArrowSrc.includes('?') ? '&' : '?') + 't=' + Date.now();
        reachArrow.classList.add('is-visible');
        clearTimeout(arrowTimer);
        arrowTimer = setTimeout(() => reachArrow.classList.remove('is-visible'), ARROW_DURATION);
      }
    });
  }
}

// Under-construction island (.proj-deco-2): unlike the clickable project
// islands, this one doesn't zoom in or open the description panel — it
// stays put. The cone tumbles over once (a one-way trip, on the 3rd touch),
// and each touch pops up a message like bumping into a locked area in a
// game — escalating from "coming soon" to increasingly done-with-you, then
// falls silent for good after the 6th.
function initConstructionToggle() {
  const toggle = document.querySelector('.construction-toggle');
  const toast = document.getElementById('comingSoonToast');
  if (!toggle || !toast) return;

  const toastTitle = toast.querySelector('.coming-soon-title');
  const toastText = toast.querySelector('.coming-soon-text');

  const TOUCHES_TO_TUMBLE = 3;
  const LAST_RESPONSIVE_TOUCH = 6;
  const TOAST_DURATION = 2000; // ms
  let touchCount = 0;
  let toastTimer = null;

  function messageForTouch(n) {
    switch (n) {
      case 1:
        return { title: 'Coming Soon', text: "There's always room for the next challenge." };
      case 2:
        return { title: 'Still Coming Soon', text: "I haven't found the next challenge yet." };
      case 3:
        return { title: 'Well, That Happened.', text: 'The cone was doing just fine.' };
      case 4:
        return { title: "You're Still Clicking?", text: 'How many times are you going to click the same thing?' };
      case 5:
        return { title: "Okay, Now You're Just Testing Me.", text: '' };
      case 6:
        return { title: "Alright, You've Seen It All.", text: 'Time to explore another island.' };
      default:
        return null;
    }
  }

  function showToast(message) {
    toastTitle.textContent = message.title;
    toastTitle.style.display = message.title ? '' : 'none';
    toastText.textContent = message.text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_DURATION);
  }

  toggle.addEventListener('click', function onClick() {
    touchCount++;
    if (touchCount === TOUCHES_TO_TUMBLE) {
      toggle.classList.add('is-fallen');
    }
    const message = messageForTouch(touchCount);
    if (message) {
      showToast(message);
    }
    if (touchCount >= LAST_RESPONSIVE_TOUCH) {
      toggle.removeEventListener('click', onClick);
    }
  });
}

// Big rock (bottom-left of the forest scene, see .rock-hitzone in
// style.css): hovering it plays lizard.gif once over the rock's own
// on-screen spot — same fresh-<img>-per-trigger approach as the signpost
// strike GIFs further down (see playStrike), since re-setting an already-
// playing GIF's src won't reliably restart its frames. Each hover gets a
// brand-new <img>, inserted only once its first frame has actually loaded
// (avoiding a blank-frame blink), and removed once one full loop has had
// time to play so repeat hovers each read as a fresh strike rather than a
// looping animation.
//
// Cooldown is enforced by disabling the hitzone itself (pointer-events:
// none, via .is-cooldown), not by timestamp-checking inside the handler —
// a real cursor can fire mouseenter/mouseleave in rapid bursts right at the
// hitzone's edge (hand tremor, or the visible GIF poking above the hitzone's
// own box as the lizard climbs, drawing the cursor to follow it out and
// back in), and a timestamp check still leaves the hitzone "live" for every
// one of those re-entries to evaluate. Making it actually stop receiving
// pointer events for COOLDOWN_MS is what guarantees only one activation per
// cooldown window, regardless of how the mouse moves.
function initRockLizard() {
  const hitzone = document.getElementById('rockHitzone');
  const stage = document.querySelector('.forest-pin-stage');
  if (!hitzone || !stage) return;

  const LIZARD_SRC = 'media/lizard.gif';
  // The GIF loops forever and its own 51 frames take exactly 5100ms
  // (verified from the file's frame-delay blocks), so a removal timer set to
  // that same 5100ms is a dead-even race against the browser's internal GIF
  // loop restart — whichever fires first wins, and when the loop wins by a
  // few ms the lizard visibly snaps back to frame 1 and starts climbing
  // again before removal finally lands a moment later. Removing comfortably
  // before the loop point avoids that flash.
  const LIZARD_DURATION_MS = 4900;
  const COOLDOWN_MS = 8000;

  new Image().src = LIZARD_SRC; // warm the cache for the first hover

  let removeTimer = null;
  let cooldownTimer = null;
  let currentLayer = null;
  let requestId = 0;

  hitzone.addEventListener('mouseenter', () => {
    hitzone.classList.add('is-cooldown');
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      hitzone.classList.remove('is-cooldown');
      cooldownTimer = null;
    }, COOLDOWN_MS);

    clearTimeout(removeTimer);
    const myRequestId = ++requestId;

    const layer = document.createElement('img');
    layer.className = 'rock-lizard-gif';
    layer.alt = '';
    layer.setAttribute('aria-hidden', 'true');
    layer.addEventListener('load', () => {
      if (myRequestId !== requestId) return;
      if (currentLayer) currentLayer.remove();
      currentLayer = layer;
      stage.appendChild(layer);
    }, { once: true });
    layer.src = LIZARD_SRC;

    removeTimer = setTimeout(() => {
      if (currentLayer) {
        currentLayer.remove();
        currentLayer = null;
      }
      removeTimer = null;
    }, LIZARD_DURATION_MS);
  });
}

// Skills content — see media/content/Skills.txt, the source of truth for
// these three lists and which prop each is attached to. Each skill is just
// a name — all text-only, per design request.
const SKILLS_DATA = {
  axe: {
    label: 'Hard Skills',
    skills: [
      { name: 'Excel' },
      { name: 'PowerPoint' },
      { name: 'Spreadsheet Modelling' },
      { name: 'Data Visualization' },
      { name: 'Presentation Design' },
      { name: 'Power BI' },
      { name: 'Agentic Workflow Development' },
      { name: 'AI-Assisted Coding' },
      { name: 'Collaborative Board Platforms' },
      { name: 'Statistical Data Analysis' },
    ],
  },
  map: {
    label: 'Professional Skills',
    skills: [
      { name: 'Design Thinking Methodologies' },
      { name: 'AGILE Way of Working' },
      { name: 'Business Analytics' },
      { name: 'Process Analysis' },
      { name: 'Process Mapping' },
      { name: 'Use-Case Development' },
      { name: 'Stakeholder Management' },
      { name: 'Change Management' },
      { name: 'Financial Analysis' },
      { name: 'Project Coordination' },
      { name: 'Innovation Management' },
      { name: 'Digital Transformation' },
    ],
  },
  figurines: {
    label: 'Soft Skills',
    skills: [
      { name: 'Structured Problem-Solving' },
      { name: 'Analytical Thinking' },
      { name: 'Communication' },
      { name: 'Ownership' },
      { name: 'Collaboration' },
      { name: 'Adaptability' },
      { name: 'Learning Agility' },
      { name: 'Public Speaking' },
      { name: 'Curiosity' },
      { name: 'Teamwork' },
      { name: 'Creativity' },
      { name: 'Digital Fluency' },
    ],
  },
};

// Skills showcase: clicking the axe, map, or figurines reveals that prop's
// skill list as pill tags (see .skills-pills in style.css) instead of just
// floating the prop itself — the float/scale/bob reveal from before is
// unchanged (still driven by the shared .is-activated class each of these
// three carries), this only adds the pills on top and makes the three
// mutually exclusive: activating one now retracts whichever of the other
// two was open, rather than letting two categories' pills show at once,
// since "the selected category" (singular) is the whole point of the
// interaction. Same click-to-open/click-outside-to-close pattern used
// elsewhere on the page (signpost hitzones, project islands) — stays open
// until dismissed by one of those two clicks, not on mouseleave.
function initSkillsShowcase() {
  const pillsPanel = document.getElementById('skillsPills');
  const categoryTag = document.getElementById('skillsCategoryTag');
  const triggers = [
    { key: 'axe', el: document.querySelector('.stump-group') },
    { key: 'map', el: document.querySelector('.skills-map') },
    { key: 'figurines', el: document.querySelector('.skills-figurines') },
  ].filter((t) => t.el);
  if (!pillsPanel || !triggers.length) return null;

  // Hover label — same feature as .project-island-title for the project
  // islands (see initProjectIslands above), reusing its exact classes so it
  // looks and animates identically: shows whichever prop is hovered/
  // focused's category name a fixed distance above it, tracked via rAF so
  // it rides along with these three's own hover lift/scale (see
  // .skills-map:hover etc. in style.css) instead of freezing in place.
  // A single line (the label, e.g. "Hard Skills") — unlike the project
  // islands' titles, there's no em-dash subtitle to split onto a second
  // one, so -sub just never gets used here.
  const SKILLS_TITLE_GAP = -20;
  const skillsTitle = document.createElement('div');
  // skills-hover-title only exists to override the color to white (see
  // style.css) — the project islands' own titles stay black, so this can't
  // just live on the shared .project-island-title rule.
  skillsTitle.className = 'project-island-title skills-hover-title';
  skillsTitle.setAttribute('aria-hidden', 'true');
  document.body.appendChild(skillsTitle);

  let trackedSkillsFloatEl = null;
  let trackedSkillsOffsetX = 0;
  let skillsTitleFrameId = null;

  function trackSkillsTitle() {
    if (!trackedSkillsFloatEl) return;
    const rect = trackedSkillsFloatEl.getBoundingClientRect();
    skillsTitle.style.left = rect.left + rect.width / 2 + trackedSkillsOffsetX + 'px';
    skillsTitle.style.top = rect.top - SKILLS_TITLE_GAP + 'px';
    skillsTitleFrameId = requestAnimationFrame(trackSkillsTitle);
  }

  function showSkillsTitle(trigger) {
    // Redundant once this one's own category is activated — its label is
    // already shown next to the "Skills" heading itself (see
    // renderCategoryTag below), so skip it there the same way the project
    // islands skip theirs once a project's open.
    if (trigger.el.classList.contains('is-activated')) return;
    const category = SKILLS_DATA[trigger.key];
    if (!category) return;

    skillsTitle.innerHTML = '';
    const lineSpan = document.createElement('span');
    lineSpan.className = 'project-island-title-main';
    lineSpan.textContent = category.label;
    skillsTitle.appendChild(lineSpan);

    skillsTitle.classList.add('is-visible');
    // The axe itself is what actually lifts on hover (see .stump-group:hover
    // .stump-axe in style.css) — .stump-group, the trigger/hitbox, never
    // moves — so it's tracked here instead, same reasoning as the project
    // islands tracking .island-float rather than their own outer button.
    trackedSkillsFloatEl = trigger.key === 'axe'
      ? (document.querySelector('.stump-axe') || trigger.el)
      : trigger.el;
    // "Hard Skills" reads off-center over the axe at the shared 0 offset
    // every other title uses — nudged left on its own rather than moving
    // the axe's tracked element itself.
    trackedSkillsOffsetX = trigger.key === 'axe' ? -40 : 0;
    if (skillsTitleFrameId === null) trackSkillsTitle();
  }

  function hideSkillsTitle() {
    skillsTitle.classList.remove('is-visible');
    trackedSkillsFloatEl = null;
    trackedSkillsOffsetX = 0;
    if (skillsTitleFrameId !== null) {
      cancelAnimationFrame(skillsTitleFrameId);
      skillsTitleFrameId = null;
    }
  }

  let pillsExitTimeout = null;
  let tagExitTimeout = null;
  let tagDurationMs = 600;
  let tagExitDurationMs = 360;

  function renderPills(key) {
    if (pillsExitTimeout) {
      clearTimeout(pillsExitTimeout);
      pillsExitTimeout = null;
    }
    const category = SKILLS_DATA[key];
    if (!category) {
      playPillsExit();
      return;
    }
    pillsPanel.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'skills-pills-list';
    category.skills.forEach((skill, i) => {
      const item = document.createElement('li');
      item.className = 'skill-pill';
      // Staggered entrance: each pill's fade-and-rise (see @keyframes
      // skill-pill-in) starts a beat after the last, capped at 12 steps'
      // worth of delay so a long list (the 12-skill Soft Skills one) still
      // finishes settling in well under a second rather than trickling in
      // for ages.
      item.style.animationDelay = `${Math.min(i, 12) * 45}ms`;
      const label = document.createElement('span');
      label.className = 'skill-pill-label';
      label.textContent = skill.name;
      item.appendChild(label);
      list.appendChild(item);
    });
    pillsPanel.appendChild(list);
    pillsPanel.classList.add('is-visible');
  }

  // Mirrors the entrance: same fade+rise, same per-pill stagger and step
  // duration, just reversed — the pill that arrived last is first to leave
  // (see @keyframes skill-pill-out / .skill-pill.is-leaving in style.css).
  // The panel stays mounted (and is-visible stays on) until every pill has
  // actually finished animating out, so this plays as a mirror of the open
  // rather than an instant cut.
  function playPillsExit() {
    const pills = Array.from(pillsPanel.querySelectorAll('.skill-pill'));
    if (!pills.length) {
      pillsPanel.classList.remove('is-visible');
      pillsPanel.innerHTML = '';
      return;
    }
    const lastIndex = pills.length - 1;
    pills.forEach((pill, i) => {
      pill.style.animationDelay = `${Math.min(lastIndex - i, 12) * 45}ms`;
      pill.classList.add('is-leaving');
    });
    const exitDuration = Math.min(lastIndex, 12) * 45 + 350;
    pillsExitTimeout = setTimeout(() => {
      pillsPanel.classList.remove('is-visible');
      pillsPanel.innerHTML = '';
      pillsExitTimeout = null;
    }, exitDuration);
  }

  // "Hard"/"Professional"/"Soft" — the category label's first word, filled
  // in to the left of the static "Skills" title with a handwriting-style
  // reveal (see .skills-category-tag in style.css — position: absolute,
  // sized to its own content, so setting the text can never shove "Skills"
  // itself around). Duration scales with word length so "Professional"
  // doesn't rush by at the same speed as "Soft".
  function renderCategoryTag(key) {
    if (!categoryTag) return;
    if (tagExitTimeout) {
      clearTimeout(tagExitTimeout);
      tagExitTimeout = null;
    }
    categoryTag.classList.remove('is-writing', 'is-erasing');
    const category = SKILLS_DATA[key];
    if (!category) {
      if (!categoryTag.textContent) return;
      // Same clip-path reveal as the open, played in reverse — the word
      // gets un-written right-to-left instead of just vanishing.
      void categoryTag.offsetWidth; // forces a reflow so re-adding below restarts the animation
      categoryTag.classList.add('is-erasing');
      tagExitTimeout = setTimeout(() => {
        categoryTag.classList.remove('is-erasing');
        categoryTag.textContent = '';
        categoryTag.removeAttribute('data-category');
        categoryTag.style.removeProperty('--tag-duration');
        categoryTag.style.removeProperty('--tag-duration-out');
        tagExitTimeout = null;
      }, tagExitDurationMs);
      return;
    }
    const word = category.label.split(' ')[0];
    categoryTag.textContent = word;
    categoryTag.dataset.category = key;
    // 50ms/letter, not 70 — "Professional" (12 letters) was dragging out
    // to 840ms, noticeably slower than "Hard"/"Soft" (both floored to the
    // 350ms minimum either way, so unaffected by this change).
    tagDurationMs = Math.max(350, word.length * 50);
    categoryTag.style.setProperty('--tag-duration', `${tagDurationMs}ms`);
    // Exit plays faster than the write-in — a lower per-letter rate and
    // floor than --tag-duration above. "Hard"/"Soft" barely move (both
    // still floored), but "Professional" (the only one long enough to
    // clear the floor) drops from 600ms to 360ms.
    tagExitDurationMs = Math.max(300, word.length * 30);
    categoryTag.style.setProperty('--tag-duration-out', `${tagExitDurationMs}ms`);
    void categoryTag.offsetWidth; // forces a reflow so re-adding is-writing below restarts the animation
    categoryTag.classList.add('is-writing');
  }

  function setActive(key) {
    triggers.forEach((t) => t.el.classList.toggle('is-activated', t.key === key));
    renderPills(key);
    renderCategoryTag(key);
    // Whatever's now active has its label shown via the category tag
    // instead (see renderCategoryTag above) — redundant with the hover
    // title, so drop that rather than leaving it stuck floating over
    // whichever prop was hovered when the click happened.
    hideSkillsTitle();
  }

  triggers.forEach((t) => {
    t.el.addEventListener('click', () => {
      const wasActive = t.el.classList.contains('is-activated');
      setActive(wasActive ? null : t.key);
    });
    t.el.addEventListener('pointerenter', () => showSkillsTitle(t));
    t.el.addEventListener('pointerleave', hideSkillsTitle);
    t.el.addEventListener('focus', () => showSkillsTitle(t));
    t.el.addEventListener('blur', hideSkillsTitle);
  });

  document.addEventListener('click', (e) => {
    const active = triggers.find((t) => t.el.classList.contains('is-activated'));
    if (!active) return;
    if (active.el.contains(e.target) || pillsPanel.contains(e.target)) return;
    setActive(null);
  });

  // Handed back to the caller (DOMContentLoaded, script.js) so onScroll can
  // retract an open category's pills — playing the same exit as clicking
  // outside them — once the user scrolls back up past the pin's midpoint,
  // same as the experience note's own auto-close going the other way.
  return { closeSkillsPills: () => setActive(null) };
}

// Hero island: hovering/touching the grass on top of the island kicks up a
// few little grass-blade particles that float up and fade out. GRASS_MASK is
// a precomputed 137x67 1-bit bitmap of hero-island-trimmed.png (1 = grass —
// green-dominant, opaque pixels only, so it excludes the transparent
// margins, the person's suit, and the brown cliff underside), generated
// offline by decoding the PNG directly. Using a baked-in mask instead of
// reading the live image with a canvas means this works even opened via
// file:// — canvas pixel reads get blocked ("tainted canvas") for local
// files without a server in some browsers.
const GRASS_MASK_WIDTH = 137;
const GRASS_MASK_HEIGHT = 67;
const GRASS_MASK_B64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAD//HAAAAAAAAAAAAAAAAAAA' +
  'ef//gAAY4AAAAAAAAAAAAAAEAD/9e//8AAAAAAAAAAAAAAAB/////wgAAAAAAAAAAAAAAAD/////' +
  '4AwAAAAAAAAB8AAAAD///v//hwAAAAAAAAP4AAAD3+P+f///4AAAAAAAB+AAAA//8/f////+AAAA' +
  'AAAB8AAAD///////4H/wAAAAAAAIAAAf///////wB/4AAAAAAAAAAB4///////wB/4AAAAAAAAAA' +
  'Dgf//////4Ac8AAAAAAAAAAAAH///////gAeAAAAAAAAAAAAAB///////wf4AAAAAAAAAAAAA//8' +
  '///3/OAAAAAAAAAAAAAAf/////H+AAAAAAAAAAAAAAAP////8PwAAAAAAAAAAAAAAAH////wfAAA' +
  'AAAAAAAAAAAAAD//8PA8AAAAAAAAAAAAAAAAD//4ABwAAAAAAAAAAAAAAAAD//AABAAAAAAAAAAA' +
  'AAAAAAH/AAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAA=';

// Flowers are only a handful of pixels each — too small/sparse for a mask
// at this resolution — so their centers were located directly by scanning
// hero-island-trimmed.png for small, compact, cream-colored (~rgb(250,245,
// 205)) blobs, distinct from the grey rocks (also bright, but on the far
// left) and the grass's own yellow-green highlight facets (lower blue
// channel). Coordinates are in the PNG's native 1370x674 pixel space.
const FLOWER_POINTS = [
  [852, 260], [879, 225], [923, 244], [983, 232],
  [1108, 147], [1111, 244], [1157, 150],
];
const FLOWER_RADIUS = 48; // px, in the same native pixel space as FLOWER_POINTS
const FLOWER_NATURAL_WIDTH = 1370;
const FLOWER_NATURAL_HEIGHT = 674;

function initGrassParticles() {
  const heroEl = document.getElementById('hero');
  const heroIsland = document.querySelector('.hero-island-main');
  if (!heroEl || !heroIsland) return;

  const SPAWN_INTERVAL = 120; // ms, throttles pointermove
  const GRASS_COLORS = ['#8fae4a', '#7a9c3f', '#a3c25c', '#5f7f34'];
  const FLOWER_COLORS = ['#f7ecd0', '#efe0b8', '#faf3df', '#e8d9a8'];

  const maskBytes = Uint8Array.from(atob(GRASS_MASK_B64), (c) => c.charCodeAt(0));

  function isGrassAt(fracX, fracY) {
    const mx = Math.min(GRASS_MASK_WIDTH - 1, Math.floor(fracX * GRASS_MASK_WIDTH));
    const my = Math.min(GRASS_MASK_HEIGHT - 1, Math.floor(fracY * GRASS_MASK_HEIGHT));
    const bitIndex = my * GRASS_MASK_WIDTH + mx;
    const byte = maskBytes[bitIndex >> 3];
    return ((byte >> (7 - (bitIndex & 7))) & 1) === 1;
  }

  function isNearFlower(fracX, fracY) {
    const px = fracX * FLOWER_NATURAL_WIDTH;
    const py = fracY * FLOWER_NATURAL_HEIGHT;
    return FLOWER_POINTS.some(([fx, fy]) => Math.hypot(px - fx, py - fy) < FLOWER_RADIUS);
  }

  let lastSpawn = 0;

  // `particleColors` is one hex string per particle (its length sets the
  // count), so a flower hover can mix in a single cream particle among
  // mostly-green ones instead of every particle matching one palette.
  function spawnParticles(x, y, particleColors) {
    const heroRect = heroEl.getBoundingClientRect();
    const islandRect = heroIsland.getBoundingClientRect();
    const originX = islandRect.left - heroRect.left + x;
    const originY = islandRect.top - heroRect.top + y;

    particleColors.forEach((color) => {
      const particle = document.createElement('span');
      particle.className = 'grass-particle';
      particle.style.setProperty('--dx', ((Math.random() - 0.5) * 70).toFixed(1) + 'px');
      particle.style.setProperty('--dy', (-40 - Math.random() * 60).toFixed(1) + 'px');
      particle.style.setProperty('--rot', ((Math.random() - 0.5) * 360).toFixed(0) + 'deg');
      particle.style.background = color;
      particle.style.left = (originX + (Math.random() - 0.5) * 16) + 'px';
      particle.style.top = (originY + (Math.random() - 0.5) * 10) + 'px';
      particle.addEventListener('animationend', () => particle.remove());
      heroEl.appendChild(particle);
    });
  }

  function randomColor(palette) {
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function handlePointer(e) {
    const rect = heroIsland.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

    const fracX = x / rect.width;
    const fracY = y / rect.height;
    const nearFlower = isNearFlower(fracX, fracY);
    if (!nearFlower && !isGrassAt(fracX, fracY)) return;

    const now = performance.now();
    if (now - lastSpawn < SPAWN_INTERVAL) return;
    lastSpawn = now;

    let colors;
    if (nearFlower) {
      // 2 green + 1 cream, shuffled so the cream one isn't always last.
      colors = [randomColor(GRASS_COLORS), randomColor(GRASS_COLORS), randomColor(FLOWER_COLORS)];
      colors.sort(() => Math.random() - 0.5);
    } else {
      const count = 2 + Math.floor(Math.random() * 2);
      colors = Array.from({ length: count }, () => randomColor(GRASS_COLORS));
    }

    spawnParticles(x, y, colors);
  }

  heroIsland.addEventListener('pointermove', handlePointer);
  heroIsland.addEventListener('pointerdown', handlePointer);
}

// Projects section: clicking an island brings it forward/enlarges it and
// parks the rest in a small vertical stack on the right, freeing up the
// center for a description panel — mirrors the "focused card" reference layout.
function initProjectIslands() {
  const canvas = document.getElementById('projectsCanvas');
  if (!canvas) return null;

  const islands = Array.from(canvas.querySelectorAll('.project-island'));

  // Handed back to the caller (DOMContentLoaded, script.js) so onScroll can
  // force-close the experience note as the forest pin passes its midpoint —
  // set once the experience signpost's own closeDescription is defined
  // further down, since that's a nested/local function this one otherwise
  // has no way to reach from outside.
  let closeExperienceDescription = null;

  // Hover label: shows whichever island is hovered/focused's project title
  // a fixed distance above it (see .project-island-title in style.css),
  // alongside the existing lift-and-scale pop. One shared, position: fixed
  // element appended to <body> — not a child of each island — so it can
  // never end up clipped by .projects-canvas's own overflow: hidden the
  // way a per-island child positioned purely in CSS could (AkzoNobel's
  // idle spot sits close enough to the canvas's top edge to have been cut
  // off). Built from the same data-title used to fill in the description
  // panel's own heading, rather than duplicating the text in the markup.
  const ISLAND_TITLE_GAP = 14; // px between the island's own top edge and the label
  const islandTitle = document.createElement('div');
  islandTitle.className = 'project-island-title';
  islandTitle.setAttribute('aria-hidden', 'true');
  document.body.appendChild(islandTitle);

  // Which element the label is currently tracking, and the rAF loop doing
  // it — .island-float (the child .project-island's idle bob keyframes
  // actually animate), not the button itself, since a transform on a
  // descendant doesn't change the ANCESTOR's own getBoundingClientRect.
  // Re-reading that child's rect every frame is what keeps the label
  // riding the bob (and the hover pop, and any activate() slide) instead
  // of freezing wherever the island happened to be when the label first
  // appeared.
  let trackedFloatEl = null;
  let trackFrameId = null;

  function trackIslandTitle() {
    if (!trackedFloatEl) return;
    const rect = trackedFloatEl.getBoundingClientRect();
    islandTitle.style.left = rect.left + rect.width / 2 + 'px';
    islandTitle.style.top = rect.top - ISLAND_TITLE_GAP + 'px';
    trackFrameId = requestAnimationFrame(trackIslandTitle);
  }

  function showIslandTitle(island) {
    // Once a project is open, every island is either the enlarged active
    // one or shifted into the small side semicircle (see activate() below)
    // — the title is redundant on the active one (already the description
    // panel's own heading) and cramped/out of place on the side ones, so
    // skip it entirely for as long as anything is active.
    if (canvas.classList.contains('has-active')) return;

    const title = island.dataset.title;
    if (!title) return;

    islandTitle.innerHTML = '';
    // Titles with an em-dash subtitle ("SDG Challenge — Best Pitch Award")
    // break onto their own line at the dash, rather than wrapping wherever
    // the text happens to run out of width. Each line gets its own class
    // (see .project-island-title-main/-sub in style.css) so the subtitle
    // reads as smaller and non-bold rather than a second heading.
    title.split(' — ').forEach((line, i) => {
      if (i > 0) islandTitle.appendChild(document.createElement('br'));
      const lineSpan = document.createElement('span');
      lineSpan.className = i === 0 ? 'project-island-title-main' : 'project-island-title-sub';
      lineSpan.textContent = line;
      islandTitle.appendChild(lineSpan);
    });

    islandTitle.classList.add('is-visible');
    trackedFloatEl = island.querySelector('.island-float') || island;
    if (trackFrameId === null) trackIslandTitle();
  }

  function hideIslandTitle() {
    islandTitle.classList.remove('is-visible');
    trackedFloatEl = null;
    if (trackFrameId !== null) {
      cancelAnimationFrame(trackFrameId);
      trackFrameId = null;
    }
  }

  islands.forEach((island) => {
    island.addEventListener('pointerenter', () => showIslandTitle(island));
    island.addEventListener('pointerleave', hideIslandTitle);
    island.addEventListener('focus', () => showIslandTitle(island));
    island.addEventListener('blur', hideIslandTitle);
  });

  const description = document.getElementById('projectsDescription');
  const descBody = document.querySelector('.projects-description-body');
  const descTitle = document.getElementById('projectsDescriptionTitle');
  const descDate = document.getElementById('projectsDescriptionDate');
  const descText = document.getElementById('projectsDescriptionText');
  const descImages = document.getElementById('projectsDescriptionImages');
  const descClose = document.getElementById('projectsDescriptionClose');

  // Project photos are sized to their own real aspect ratio (see the
  // is-pair/is-single image-building block in activate() below) rather than
  // a shared crop box, so none of them get cropped — AkzoNobel's two and
  // the Samsung/SDG ones are all different shapes. That needs each photo's
  // natural width/height known before it's ever inserted (so the box is
  // correctly sized immediately, with nothing to wait on for layout), so
  // every photo across all four projects is preloaded once up front here
  // rather than only once its own project is opened.
  const imageDims = new Map();
  islands.forEach((island) => {
    (island.dataset.images || '')
      .split(',')
      .map((src) => src.trim())
      .filter(Boolean)
      .forEach((src) => {
        if (imageDims.has(src)) return;
        const probe = new Image();
        probe.addEventListener('load', () => {
          imageDims.set(src, { w: probe.naturalWidth, h: probe.naturalHeight });
        });
        probe.src = src;
      });
  });

  const ACTIVE_LEFT = 12;
  const ACTIVE_TOP = 4;
  const ACTIVE_WIDTH = 30; // vw

  // Bekske Coffee and AkzoNobel sit lower than the shared ACTIVE_TOP once
  // activated — their island art reads better a bit further down the scene
  // than the SDG trophy's does at the same position. Samsung gets a
  // smaller nudge of its own, not the full drop the other two get.
  const ACTIVE_TOP_OVERRIDES = { coffee: 14, akzonobel: 14, samsung: 7 };

  // The 3 non-active islands fan out in a semicircle over the small island
  // on the right (.proj-deco-2, centered around left:100% / top:55%),
  // ordered top-to-bottom along the arc.
  const SEMI_SLOTS = [
    { left: 91, top: 18, width: 8.5 },
    { left: 82, top: 26, width: 9 },
    { left: 79, top: 39, width: 8.5 },
  ];

  let activeIsland = null;

  // Always animate via `left` (never switch to `right`) — CSS transitions
  // can't interpolate between different properties, or to/from `auto`, so
  // toggling left/right per state meant islands snapped instead of sliding.
  function placeIsland(el, left, top, width) {
    el.style.left = left + '%';
    el.style.top = top + '%';
    el.style.width = width + 'vw';
  }

  function activate(island) {
    activeIsland = island;
    canvas.classList.add('has-active');
    // Clicking an island while its own hover title is still showing (or,
    // via keyboard, activating one while focus put another's title up)
    // shouldn't leave that label lingering now that showIslandTitle
    // refuses to show a new one while a project's active.
    hideIslandTitle();

    islands.forEach((el) => el.classList.remove('is-active'));
    island.classList.add('is-active');

    const activeTop = ACTIVE_TOP_OVERRIDES[island.dataset.project] ?? ACTIVE_TOP;
    placeIsland(island, ACTIVE_LEFT, activeTop, ACTIVE_WIDTH);

    const rest = islands.filter((el) => el !== island);
    rest.forEach((el, i) => {
      const slot = SEMI_SLOTS[i];
      placeIsland(el, slot.left, slot.top, slot.width);
    });

    // Drives the per-project title font-size overrides in style.css (see
    // .projects-description-title there) — titles are wildly different
    // lengths ("AkzoNobel Innovation Clinic" vs "Samsung Solve for
    // Tomorrow — Finalist"), so one shared size can't fit all of them on a
    // single line without either wrapping the long ones or shrinking the
    // short ones more than they need.
    description.dataset.project = island.dataset.project || '';

    descTitle.textContent = island.dataset.title || '';
    descDate.textContent = island.dataset.date || '';

    descText.innerHTML = '';
    (island.dataset.description || '')
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean)
      .forEach((para) => {
        const p = document.createElement('p');
        p.textContent = para;
        descText.appendChild(p);
      });

    // Rebuilt fresh every activation (including switching straight from one
    // project to another) so the slide-in below always replays rather than
    // only firing the first time the panel opens. Same reflow trick as the
    // skills tag reveal: remove -> repopulate -> force layout -> re-add, so
    // the browser actually paints the pre-slide (rest) position for at
    // least one frame before the transition is asked to animate away from it.
    descImages.classList.remove('is-visible', 'is-pair', 'is-single');
    descImages.innerHTML = '';
    descImages.style.height = '';
    descImages.style.width = '';
    const imageSrcs = (island.dataset.images || '')
      .split(',')
      .map((src) => src.trim())
      .filter(Boolean);
    const imgEls = imageSrcs.map((src) => {
      const img = document.createElement('img');
      img.className = 'projects-description-image';
      img.src = src;
      img.alt = `${island.dataset.title || 'Project'} photo`;
      img.loading = 'lazy';
      // Each photo's box is sized to its own real aspect ratio (from the
      // preload cache above), not a shared crop box — that's what stops
      // any of them getting cropped. Falls back to a generic landscape
      // ratio only if this exact photo somehow hasn't finished preloading
      // yet by the time its project is opened.
      const dims = imageDims.get(src);
      img.style.aspectRatio = dims ? `${dims.w} / ${dims.h}` : '3 / 2';
      descImages.appendChild(img);
      return img;
    });
    // Two photos overlap as a scattered pair (see .is-pair in style.css);
    // one sits centered on its own (.is-single); none collapses the block
    // entirely.
    descImages.classList.toggle('is-pair', imgEls.length >= 2);
    descImages.classList.toggle('is-single', imgEls.length === 1);

    // The pair is widened past the panel's own edge in style.css (116%) so
    // the photos can spill slightly into the open scene rather than being
    // boxed to the write-up's exact column width — but unlike the panel
    // itself, .projects-canvas DOES clip (overflow: hidden), and at
    // narrower viewports the panel already sits close enough to its right
    // edge that the full 116% would cross it. Clamped here to whatever
    // room is actually left, rather than in the CSS width itself, since
    // that room depends on the panel's live position, not just its own
    // size. Done before the height budget below so that budget measures
    // photos at their actual (possibly clamped) rendered size.
    if (imgEls.length >= 2) {
      void descImages.offsetWidth;
      const canvasRight = canvas.getBoundingClientRect().right;
      // The container's own getBoundingClientRect() doesn't expand to
      // include an absolutely-positioned child that pokes past its box
      // (the second photo deliberately sits past its own top-right corner,
      // in style.css) — checking each photo's actual right edge, not just
      // the container's, is what catches that.
      const rightmostEdge = Math.max(
        descImages.getBoundingClientRect().right,
        ...imgEls.map((img) => img.getBoundingClientRect().right)
      );
      const SIDE_SAFETY = 12;
      const overflowAmount = rightmostEdge - canvasRight + SIDE_SAFETY;
      if (overflowAmount > 0) {
        descImages.style.width = descImages.getBoundingClientRect().width - overflowAmount + 'px';
      }
    }

    // .projects-description-body's max-height is set here rather than as a
    // fixed CSS formula: the photo collage sizes itself off its OWN width
    // (aspect-ratio, not a fixed px height), which doesn't correlate
    // cleanly with the canvas's height (driven by viewport width via 46vw)
    // the way a static split needs it to — that mismatch is exactly what
    // let AkzoNobel's photos overflow past the canvas's own bottom edge at
    // narrow widths before. Measuring the collage's actual rendered height
    // and subtracting it from the actual room left below the panel's top
    // is correct at every viewport size and every photo count, no
    // guesswork. This doesn't need to wait on the photos' bytes loading —
    // aspect-ratio-based sizing only needs the box's width, which is
    // already resolved by the forced reflow below.
    void descImages.offsetHeight;
    // The overlapping pair's photos are position: absolute (so they can sit
    // on top of one another), which means neither contributes to the
    // container's own auto height — set it explicitly instead, from
    // whichever photo's bottom edge actually sits lowest. Measuring each
    // photo's own rendered bottom (rather than just its height) is what
    // keeps this correct even though they're deliberately offset from each
    // other in style.css (e.g. the first one sits nudged below where the
    // container's own edge would otherwise be) — a plain height comparison
    // would miss that offset and undersize the container, letting that
    // photo poke out past the budget calculated below.
    if (imgEls.length >= 2) {
      const containerTop = descImages.getBoundingClientRect().top;
      const lowestBottom = Math.max(...imgEls.map((img) => img.getBoundingClientRect().bottom));
      descImages.style.height = Math.max(0, lowestBottom - containerTop) + 'px';
    }
    // getBoundingClientRect().height is the images block's border-box only —
    // its own margin-top (the gap between it and the body above) still has
    // to be accounted for separately, since margins never show up in a
    // box's own rect.
    const imagesMarginTop = imageSrcs.length ? parseFloat(getComputedStyle(descImages).marginTop) || 0 : 0;
    const imagesBlockHeight = imageSrcs.length ? descImages.getBoundingClientRect().height + imagesMarginTop : 0;
    const canvasRect = canvas.getBoundingClientRect();
    const panelTop = description.getBoundingClientRect().top;
    const BOTTOM_BREATHING_ROOM = 16;
    const roomBelowPanelTop = canvasRect.bottom - panelTop - imagesBlockHeight - BOTTOM_BREATHING_ROOM;
    // Capped at 40% of the canvas's own height on top of the room-based
    // limit above — without this the panel's top staying fixed (4%) while
    // there's a lot of open canvas below it meant the write-up would
    // stretch to fill nearly the whole section instead of staying a
    // compact note that scrolls for the longer projects.
    const SHORT_PANEL_CAP = canvasRect.height * 0.4;
    descBody.style.maxHeight = Math.max(120, Math.min(roomBelowPanelTop, SHORT_PANEL_CAP)) + 'px';

    descImages.classList.add('is-visible');
  }

  function deactivate() {
    activeIsland = null;
    canvas.classList.remove('has-active');
    islands.forEach((el) => {
      el.classList.remove('is-active');
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
    });
  }

  islands.forEach((island) => {
    island.addEventListener('click', () => {
      if (activeIsland === island) {
        deactivate();
      } else {
        activate(island);
      }
    });
  });

  descClose.addEventListener('click', deactivate);

  canvas.addEventListener('click', (e) => {
    if (e.target === canvas) deactivate();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeIsland) deactivate();
  });

  // Signpost: signpost_composite.png is the resting image, and stays put in
  // the DOM the whole time — touching either invisible hitzone plays that
  // sign's shake GIF (both are 55 frames, 54 at 40ms + a final 520ms hold =
  // 2680ms, encoded to loop forever) on a separate layer stacked on top of
  // it, then removes that layer once the one pass has had time to play, so
  // it reads as a single strike, not a looping animation, and the static
  // composite shows back through underneath. Each strike gets a brand-new
  // <img>, since re-setting the same src on a *reused* element won't
  // reliably restart an already-playing GIF's frames — but a fresh element
  // only gets inserted (on top of whatever's currently showing) once its
  // own 'load' fires, i.e. once its first frame is actually ready to paint.
  // That's what avoids the blank-frame "blink" the old clear-src-then-
  // reassign approach caused: nothing here is ever hidden or cleared before
  // its replacement is known to be ready to show.
  //
  // The static image is hidden (not removed) for as long as a GIF layer is
  // showing, rather than left visible underneath it: the shake moves the
  // chains and signs off their resting position, so the static composite's
  // own chains/signs — being a different pose — showed through anywhere the
  // GIF didn't fully occlude them, doubling both. Hiding and unhiding it
  // happen in the same tick as inserting/removing the GIF layer, so exactly
  // one layer is ever visible at a time and there's still no blink.
  const signpostScene = document.querySelector('.signpost-scene');
  const signpostImage = document.getElementById('signpostImage');
  const hitzoneTop = document.querySelector('.signpost-hitzone-top');
  const hitzoneBottom = document.querySelector('.signpost-hitzone-bottom');

  if (signpostScene && signpostImage && hitzoneTop && hitzoneBottom) {
    const GIF_TOP_SRC = 'media/signpost_shake_upper_struck.gif';
    const GIF_BOTTOM_SRC = 'media/signpost_shake_lower_struck.gif';
    const STRIKE_DURATION_MS = 2680;

    // Warm the browser cache so the first touch doesn't stall on a
    // multi-megabyte fetch before the strike can start.
    [GIF_TOP_SRC, GIF_BOTTOM_SRC].forEach((src) => { new Image().src = src; });

    let revertTimer = null;
    let currentLayer = null;
    // Bumped on every call so a slow-to-load layer from an earlier, since-
    // superseded strike (e.g. the mouse crossing both hitzones in quick
    // succession) can tell, once it finally does load, that it's stale and
    // skip inserting itself instead of clobbering whatever's playing now.
    let requestId = 0;

    function playStrike(gifSrc) {
      clearTimeout(revertTimer);
      const myRequestId = ++requestId;

      const layer = document.createElement('img');
      layer.className = 'signpost-image signpost-strike-layer';
      layer.alt = '';
      layer.setAttribute('aria-hidden', 'true');
      layer.addEventListener('load', () => {
        if (myRequestId !== requestId) return;
        if (currentLayer) currentLayer.remove();
        currentLayer = layer;
        signpostImage.style.visibility = 'hidden';
        signpostScene.insertBefore(layer, hitzoneTop);
      }, { once: true });
      layer.src = gifSrc;

      revertTimer = setTimeout(() => {
        if (currentLayer) {
          currentLayer.remove();
          currentLayer = null;
        }
        signpostImage.style.visibility = '';
        revertTimer = null;
      }, STRIKE_DURATION_MS);
    }

    hitzoneTop.addEventListener('mouseenter', () => playStrike(GIF_TOP_SRC));
    hitzoneBottom.addEventListener('mouseenter', () => playStrike(GIF_BOTTOM_SRC));

    // Job-detail panel: opens only on a click of a sign (never on the
    // hover above, which is reserved for the shake GIF), showing that
    // sign's own data-logo/data-position/data-description — the company
    // name is the actual brand logo (matching the one painted on that
    // sign), not text, so there's no separate "company name" field.
    // Closes on a second click of the same sign, the panel's own close
    // button, a click anywhere else, or Escape.
    const description = document.getElementById('experienceDescription');
    const descLogo = document.getElementById('experienceDescriptionLogo');
    const descDate = document.getElementById('experienceDescriptionDate');
    const descPosition = document.getElementById('experienceDescriptionPosition');
    const descText = document.getElementById('experienceDescriptionText');
    const descClose = document.getElementById('experienceDescriptionClose');
    const descPhoto = document.getElementById('experienceDescriptionPhoto');

    if (description && descLogo && descDate && descPosition && descText && descClose) {
      let activeHitzone = null;
      let switchTimer = null;
      // Matches .experience-description-slide's exit transition duration
      // (style.css, the base rule's — closing transitions TO that state)
      // — switching signs waits for the slide-out to finish before
      // swapping content and sliding the new one in, rather than the
      // content just changing mid-slide or instantly in place.
      const SLIDE_DURATION_MS = 550;

      function setContent(hitzone) {
        descDate.textContent = hitzone.dataset.date || '';
        descLogo.src = hitzone.dataset.logo || '';
        descLogo.alt = hitzone.dataset.logoAlt || '';
        // DP World's logo reads larger than Philips' at the same height
        // (see .experience-description-logo.is-dp-world in style.css), so
        // it gets its own smaller size rather than sharing one height for both.
        descLogo.classList.toggle('is-dp-world', hitzone.dataset.logoAlt === 'DP World');
        // Philips' position title (see .experience-description-position.is-philips
        // in style.css) needs its own tighter offset — its taller logo and
        // its title's two-line wrap don't line up the same as DP World's.
        descPosition.classList.toggle('is-philips', hitzone.dataset.logoAlt === 'Philips');
        descPosition.textContent = hitzone.dataset.position || '';
        // Keepsake photo only exists for the Philips role — DP World's sign
        // just leaves it hidden (see .experience-description-photo in
        // style.css).
        const isPhilips = hitzone.dataset.logoAlt === 'Philips';
        if (descPhoto) descPhoto.classList.toggle('is-visible', isPhilips);
        // Philips' photo sits over the bottom-left of this box, so its
        // write-up runs smaller than DP World's (see
        // .experience-description-text.has-photo in style.css) — just
        // enough that it wraps into a shorter block and stays clear of the
        // photo, without moving or resizing the photo itself.
        descText.classList.toggle('has-photo', isPhilips);

        // Split on blank lines into separate <p>s (same convention as the
        // project write-ups in initProjectIslands above) so multi-paragraph
        // descriptions get real paragraph spacing instead of running
        // together as one block.
        descText.innerHTML = '';
        (hitzone.dataset.description || '')
          .split(/\n\s*\n/)
          .map((para) => para.trim())
          .filter(Boolean)
          .forEach((para) => {
            const p = document.createElement('p');
            p.textContent = para;
            descText.appendChild(p);
          });
      }

      function openDescription(hitzone) {
        activeHitzone = hitzone;
        setContent(hitzone);
        description.classList.add('is-visible');
      }

      function closeDescription() {
        activeHitzone = null;
        clearTimeout(switchTimer);
        description.classList.remove('is-visible');
      }

      closeExperienceDescription = closeDescription;

      // Slides the current sign's panel out, then swaps in the new sign's
      // content and slides it back in, instead of the content just
      // changing instantly while already open.
      function switchDescription(hitzone) {
        activeHitzone = hitzone;
        clearTimeout(switchTimer);
        description.classList.remove('is-visible');
        switchTimer = setTimeout(() => {
          setContent(hitzone);
          description.classList.add('is-visible');
        }, SLIDE_DURATION_MS);
      }

      [hitzoneTop, hitzoneBottom].forEach((hitzone) => {
        hitzone.addEventListener('click', () => {
          if (activeHitzone === hitzone) {
            closeDescription();
          } else if (activeHitzone) {
            switchDescription(hitzone);
          } else {
            openDescription(hitzone);
          }
        });
      });

      descClose.addEventListener('click', closeDescription);

      document.addEventListener('click', (e) => {
        if (!activeHitzone) return;
        if (description.contains(e.target) || e.target === hitzoneTop || e.target === hitzoneBottom) return;
        closeDescription();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeHitzone) closeDescription();
      });
    }
  }

  return { closeExperienceDescription };
}

// Lightbox for project photos: clicking any .projects-description-image (or
// the Philips keepsake photo, .experience-description-photo) enlarges it
// over a dimmed, full-viewport backdrop (see .image-lightbox in style.css).
// Delegated to the document rather than a listener per photo —
// those are rebuilt fresh on every project activation (see activate() in
// initProjectIslands above), so a per-element listener would need
// re-attaching each time; delegating to a stable ancestor sidesteps that.
function initImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('imageLightboxImg');
  if (!lightbox || !lightboxImg) return;

  // Same technique as placeIsland/activate (initProjectIslands above): a
  // permanent CSS transition on left/top/width/height (see .image-lightbox-img
  // in style.css) that JS just assigns plain px values to, rather than
  // toggling an inline `transition` string and animating via `transform` —
  // that approach turned out unreliable for the close leg here, where the
  // "before" state is a settled rest state rather than something just
  // painted a frame ago. Matching the islands' own proven mechanism sidesteps
  // that: any left/top/width/height change just animates, in either direction,
  // with no reflow-forcing or transition-swapping needed.
  const CLOSE_DURATION_MS = 600;

  // Caps the enlarged size (doesn't upscale past the photo's own natural
  // resolution — same as the old width:auto/height:auto + max-width/
  // max-height rule this replaces), then centers it in the viewport.
  function finalRectFor(naturalWidth, naturalHeight) {
    const maxWidth = Math.min(window.innerWidth * 0.6, 720);
    const maxHeight = window.innerHeight * 0.64;
    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  }

  function placeLightboxImg(rect, rotateDeg) {
    lightboxImg.style.left = rect.left + 'px';
    lightboxImg.style.top = rect.top + 'px';
    lightboxImg.style.width = rect.width + 'px';
    lightboxImg.style.height = rect.height + 'px';
    lightboxImg.style.rotate = (rotateDeg || 0) + 'deg';
  }

  // Some thumbnails (.story-map-photo) sit tilted on the page — reads that
  // straight off the element's own computed transform (0 for the untilted
  // ones, project/experience photos) rather than hardcoding an angle per
  // source, so open()/close() below work the same regardless of which kind
  // of thumbnail triggered them.
  function angleOf(el) {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m = new DOMMatrix(t);
    return Math.atan2(m.b, m.a) * (180 / Math.PI);
  }

  // getBoundingClientRect() on a rotated element returns the rotated
  // shape's own axis-aligned bounding box — bigger than the photo's actual
  // width/height, and not what placeLightboxImg (which then applies that
  // same rotation itself, see below) should be sized to; double-applying
  // the rotation's effect would land the copy at the wrong size/spot. A
  // rotation around center doesn't move the box's center point, though, so
  // that part of the bounding rect is still trustworthy — this reconstructs
  // the true (pre-rotation) box from that center plus the element's real,
  // untransformed layout size (offsetWidth/Height, unaffected by
  // `transform`). Reduces to a plain getBoundingClientRect() for anything
  // unrotated (the project/experience photos), so it's safe to use
  // everywhere rather than just for .story-map-photo.
  function trueRectOf(el) {
    const rect = el.getBoundingClientRect();
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    return {
      left: rect.left + rect.width / 2 - width / 2,
      top: rect.top + rect.height / 2 - height / 2,
      width,
      height,
    };
  }

  // Which on-page thumbnail this enlargement came from, so close() knows
  // where to shrink back to. Also hidden for as long as the lightbox copy
  // stands in for it (see open/restoreSource below) so there's only ever
  // one visible photo — otherwise the dimmed thumbnail would still show
  // faintly through the backdrop next to its own enlarged copy. Cleared
  // once the close animation finishes.
  let sourceImg = null;
  let closeTimeoutId = null;

  // Un-hides whatever thumbnail is currently standing in for the lightbox
  // copy, if any. Called both when a close animation finishes and when a
  // new photo is opened mid-close (clearing the previous one's timeout
  // would otherwise leave it invisible forever).
  function restoreSource() {
    if (sourceImg && sourceImg.isConnected) {
      sourceImg.style.visibility = '';
    }
    sourceImg = null;
  }

  function open(img) {
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    restoreSource();

    sourceImg = img;
    const startRect = trueRectOf(img);
    const startAngle = angleOf(img);
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    // The copy takes over from here — hide the original so only one photo
    // is ever visible, rather than a faint dimmed duplicate sitting behind
    // the backdrop at its old spot.
    img.style.visibility = 'hidden';

    lightbox.classList.add('is-visible');
    lightbox.setAttribute('aria-hidden', 'false');

    const playOpen = () => {
      // Snap to the thumbnail's exact spot with transitions off, so the
      // very next (transitioned) change below is the first thing that
      // actually animates — same forced-reflow trick activate() uses
      // before placeIsland when it wants a fresh slide-in to replay.
      // visibility isn't in the transition list, so setting it here has
      // no fade of its own — it just reveals the copy exactly where the
      // (now-hidden) original was.
      lightboxImg.style.transition = 'none';
      placeLightboxImg(startRect, startAngle);
      lightboxImg.style.visibility = 'visible';
      lightboxImg.getBoundingClientRect();

      requestAnimationFrame(() => {
        lightboxImg.style.transition = '';
        placeLightboxImg(finalRectFor(lightboxImg.naturalWidth, lightboxImg.naturalHeight), 0);
      });
    };

    // A cached photo reports complete/naturalWidth synchronously; a fresh
    // one needs its load event before naturalWidth/Height (needed for
    // finalRectFor above) is known.
    if (lightboxImg.complete && lightboxImg.naturalWidth) {
      playOpen();
    } else {
      lightboxImg.addEventListener('load', playOpen, { once: true });
    }
  }

  function close() {
    if (!lightbox.classList.contains('is-visible')) return;

    lightbox.classList.remove('is-visible');
    lightbox.setAttribute('aria-hidden', 'true');

    // Shrink back to the thumbnail only if it's still on the page — the
    // projects panel rebuilds its image list on every project switch (see
    // initProjectIslands), so the original element can be long gone by
    // the time this fires. The already-active CSS transition (same rule
    // that animated the open) picks up this change on its own — no
    // transition-swapping needed, exactly like placeIsland.
    if (sourceImg && sourceImg.isConnected) {
      placeLightboxImg(trueRectOf(sourceImg), angleOf(sourceImg));
    } else {
      const r = lightboxImg.getBoundingClientRect();
      placeLightboxImg({
        left: r.left + r.width * 0.04,
        top: r.top + r.height * 0.04,
        width: r.width * 0.92,
        height: r.height * 0.92,
      }, 0);
    }

    closeTimeoutId = setTimeout(() => {
      // The move has finished and (if it's still there) the original
      // thumbnail is sitting at this exact spot — hide the copy and
      // reveal it in the same tick so the swap is imperceptible.
      lightboxImg.style.visibility = 'hidden';
      restoreSource();
      closeTimeoutId = null;
    }, CLOSE_DURATION_MS);
  }

  document.addEventListener('click', (e) => {
    const img = e.target.closest('.projects-description-image, .experience-description-photo, .story-map-photo');
    if (img) open(img);
  });

  // The backdrop and the enlarged photo itself both close it — the only two
  // things inside the overlay now that there's no close button.
  // stopPropagation so this click doesn't also reach the document-level
  // "click outside" listeners that close the projects/experience panels
  // (e.g. initExperienceSignposts above) — the lightbox sits outside both
  // panels in the DOM, so without this, clicking it to shrink the photo
  // back would also close whichever panel it was opened from.
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('image-lightbox-backdrop') || e.target === lightboxImg) {
      e.stopPropagation();
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-visible')) close();
  });
}
