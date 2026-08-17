/* ---------------------------------------------------------------------------
   Nodal site theme picker.

   The same colour themes the app offers under Settings (see THEME_PRESETS in
   bot_pipeline/public/index.html), available to anyone browsing the site: each
   preset is 5 hex colours, lightest to darkest, mapped onto the brand tokens in
   theme.css as inline overrides on <html>. Inline styles beat the stylesheet's
   automatic light/dark rules whatever the machine is set to, which is what lets
   a chosen theme stick.

   Ramps and preset names are kept identical to the app's on purpose - a visitor
   who picks "Slate" here should meet the same Slate after signing up. The app
   persists the choice per account; the site has no accounts, so it remembers
   the pick in localStorage for this browser.

   Loaded as a blocking script in <head> so the stored theme is applied before
   first paint (no flash of the default palette); the picker UI itself waits
   for the body.
   --------------------------------------------------------------------------- */

(function () {
  'use strict';

  var THEME_PRESETS = [
    // The brand default. colors: null means "no inline overrides" - the
    // stylesheet's full navy/pale-yellow token set applies as-is, including its
    // dark-mode variant and the tokens a 5-colour ramp has no slot for. The
    // swatches are display-only.
    { name: 'Nodal Classic', colors: null, swatches: ['#FFFFFF', '#F8F9FA', '#FFF59E', '#596A83', '#0D2B52'] },
    // Two variations on Classic, kept next to it since they're the same brand
    // navy rather than separate hues. Soft: Classic rotated off navy onto sky
    // blue, and turned up rather than down, so surfaces read as pale sky rather
    // than grey with a hint of blue.
    { name: 'Nodal Soft', colors: ['#F2FAFF', '#D6EBFA', '#35688F', '#0F6FA8', '#0E3350'], dark: ['#133449', '#0C2333', '#8CB8D6', '#26689A', '#E2F1FB'] },
    // Light: deliberately has NO dark ramp, and scheme: 'light' on top. Classic
    // follows the machine into a dark navy UI; this is the one that stays bright
    // and navy-on-white whatever the OS is set to.
    { name: 'Nodal Light', colors: ['#FFFFFF', '#F1F5FC', '#5A6D8F', '#1F4E8C', '#16304F'], scheme: 'light' },
    // Each ramp follows the Nodal Classic contrast recipe with the two light
    // stops pushed into clearly tinted pastels, so the theme's hue reads on
    // every surface. Slot order in both ramps: panel, bg, muted, accent, text.
    { name: 'Clarion', colors: ['#DFE2F0', '#CDD1E6', '#3F4663', '#2E355C', '#181B2C'], dark: ['#20243E', '#14172A', '#A0A7C8', '#4B549A', '#ECEEF8'] },
    { name: 'Slate', colors: ['#DCE4EC', '#C6D4DF', '#3A4B60', '#2A4055', '#141E28'], dark: ['#1C2836', '#111A24', '#93A7BB', '#3D5F80', '#EAF1F7'] },
    { name: 'Indigo', colors: ['#E2DFF0', '#D1CCE5', '#453F66', '#37305F', '#1B1730'], dark: ['#262040', '#17132C', '#A49CC8', '#554789', '#EFECF8'] },
    { name: 'Refulgent', colors: ['#D9E5EF', '#C2D5E4', '#354A5F', '#1F4664', '#12212E'], dark: ['#16283A', '#0D1926', '#8FA9C0', '#2F6491', '#E9F1F8'] },
    { name: 'Vespertine', colors: ['#DFE0EE', '#CBCDE2', '#3E4360', '#2B3158', '#171A2C'], dark: ['#22253F', '#14162B', '#9BA1C6', '#464E8C', '#ECEDF7'] },
  ];

  // Every token applyTheme writes, so switching back to the default can clear
  // the lot and hand the page back to the stylesheet.
  var THEME_VARS = [
    '--panel', '--bg', '--border', '--muted', '--accent', '--accent-hover',
    '--on-accent', '--text', '--shadow-sm', '--shadow-md',
  ];

  // A scheme-locked preset has to pin color-scheme too, or on a machine set to
  // dark mode its light surfaces end up carrying dark native controls
  // (scrollbars) - the browser takes those from the scheme, not from our
  // variables.
  var LIGHT_SCHEME_VARS = { 'color-scheme': 'light' };

  var LIGHT_SHADOWS = ['0 2px 12px rgba(13, 43, 82, 0.06)', '0 2px 24px rgba(13, 43, 82, 0.08)'];
  var DARK_SHADOWS = ['0 2px 12px rgba(0, 0, 0, 0.35)', '0 2px 24px rgba(0, 0, 0, 0.45)'];

  var STORAGE_KEY = 'nodal:theme';

  // ---------------------------------------------------------------------
  // Applying a ramp
  // ---------------------------------------------------------------------

  // Rough luminance, only used to compare ramp ends (which of c1/c5 is lighter).
  function rampLum(hex) {
    var parts = hex.match(/[0-9a-f]{2}/gi).map(function (h) { return parseInt(h, 16) / 255; });
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  }

  function applyTheme(colors, lockLight) {
    var root = document.documentElement.style;
    // Cleared unconditionally, so switching off a scheme-locked preset onto any
    // other theme hands color-scheme back to the stylesheet.
    if (lockLight) {
      Object.keys(LIGHT_SCHEME_VARS).forEach(function (k) { root.setProperty(k, LIGHT_SCHEME_VARS[k]); });
    } else {
      Object.keys(LIGHT_SCHEME_VARS).forEach(function (k) { root.removeProperty(k); });
    }

    if (!colors) {
      THEME_VARS.forEach(function (v) { root.removeProperty(v); });
      return;
    }

    var c1 = colors[0], c2 = colors[1], c3 = colors[2], c4 = colors[3], c5 = colors[4];
    root.setProperty('--panel', c1);
    root.setProperty('--bg', c2);
    // Borders are a light tint of the muted stop rather than a raw ramp stop:
    // with a Nodal-Classic-style ramp (near-white lights, dark muted) the raw
    // stops are either invisible (border = bg) or far too heavy. color-mix
    // strings resolve in CSS at use time.
    root.setProperty('--border', 'color-mix(in srgb, ' + c3 + ' 30%, ' + c2 + ')');
    root.setProperty('--muted', c3);
    root.setProperty('--accent', c4);
    // Mirror the default scheme's hover (a slightly lighter navy) in the ramp's hue.
    root.setProperty('--accent-hover', 'color-mix(in srgb, #fff 12%, ' + c4 + ')');
    // Text on the accent needs the ramp's light end: c1 on a light ramp, c5 on a
    // dark one (where the panel stop is itself dark).
    root.setProperty('--on-accent', rampLum(c1) >= rampLum(c5) ? c1 : c5);
    root.setProperty('--text', c5);
    // Shadows follow the ramp rather than the machine's scheme: a soft navy
    // shadow disappears entirely on a dark surface.
    var shadows = rampLum(c1) < 0.5 ? DARK_SHADOWS : LIGHT_SHADOWS;
    root.setProperty('--shadow-sm', shadows[0]);
    root.setProperty('--shadow-md', shadows[1]);
  }

  // Scheme-aware application: presets carry a light ramp (colors) and a dark one
  // (dark); which is applied follows the machine's colour scheme, live. The
  // current choice is remembered so a mid-session scheme flip can re-resolve it.
  var darkSchemeMq = window.matchMedia('(prefers-color-scheme: dark)');
  var activeChoice = null; // null = built-in default; else { name, colors }

  function presetFor(choice) {
    if (!choice || !choice.name) return null;
    for (var i = 0; i < THEME_PRESETS.length; i++) {
      if (THEME_PRESETS[i].name === choice.name) return THEME_PRESETS[i];
    }
    return null;
  }

  function resolveRamp(choice) {
    var preset = presetFor(choice);
    if (!preset) return null; // unknown name: hand the page back to the stylesheet
    // A preset with no `dark` ramp resolves to its light one in either scheme -
    // which is what makes Nodal Light stay light.
    return darkSchemeMq.matches && preset.dark ? preset.dark : preset.colors;
  }

  function applyChoice(choice) {
    activeChoice = choice;
    var preset = presetFor(choice);
    applyTheme(resolveRamp(choice), !!(preset && preset.scheme === 'light'));
  }

  // ---------------------------------------------------------------------
  // Persistence (this browser only - the site has no accounts)
  // ---------------------------------------------------------------------

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      // Only named presets are honoured; anything else (including a custom ramp
      // saved by an older version of the picker) falls back to the default.
      if (!saved || !saved.name) return null;
      return { name: saved.name };
    } catch (err) {
      return null; // no storage (private mode) or corrupt value: use the default
    }
  }

  function store(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (err) {
      // Storage unavailable: the choice still applies for this page view.
    }
  }

  // A stored theme is only a preset name, re-resolved from THEME_PRESETS - so
  // later refinements to a preset reach people who picked it before the change.
  applyChoice(readStored());

  // ---------------------------------------------------------------------
  // Picker UI
  // ---------------------------------------------------------------------

  var LAUNCHER_ICON =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 3.2a8.8 8.8 0 000 17.6c1.2 0 1.9-.8 1.9-1.8 0-.9-.6-1.5-.6-2.3 0-.9.7-1.6 1.7-1.6h1.5a4.4 4.4 0 004.3-4.4c0-4.3-4.1-7.5-8.8-7.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="8" cy="9.2" r="1.15" fill="currentColor"/>' +
    '<circle cx="12" cy="7.2" r="1.15" fill="currentColor"/>' +
    '<circle cx="16" cy="9.6" r="1.15" fill="currentColor"/>' +
    '<circle cx="7.6" cy="13.6" r="1.15" fill="currentColor"/>' +
    '</svg>';

  function buildPicker() {
    var wrap = document.createElement('div');
    wrap.className = 'nodal-theme';

    var launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'nodal-theme-launcher';
    launcher.setAttribute('aria-label', 'Change colour theme');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = LAUNCHER_ICON;

    var panel = document.createElement('div');
    panel.className = 'nodal-theme-panel';
    panel.hidden = true;

    var title = document.createElement('div');
    title.className = 'nodal-theme-title';
    title.textContent = 'Colour theme';
    panel.appendChild(title);

    var presetsEl = document.createElement('div');
    presetsEl.className = 'nodal-theme-presets';
    panel.appendChild(presetsEl);

    var note = document.createElement('p');
    note.className = 'nodal-theme-note';
    note.textContent = 'Saved in this browser.';
    panel.appendChild(note);

    wrap.appendChild(launcher);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    function renderPresets(selectedName) {
      presetsEl.innerHTML = '';
      THEME_PRESETS.forEach(function (preset) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nodal-theme-preset' + (preset.name === selectedName ? ' selected' : '');
        btn.setAttribute('aria-pressed', preset.name === selectedName ? 'true' : 'false');
        // Swatches preview the ramp the current colour scheme would actually get.
        var swatchRamp = preset.swatches || (darkSchemeMq.matches && preset.dark ? preset.dark : preset.colors);
        swatchRamp.forEach(function (c) {
          var sw = document.createElement('span');
          sw.className = 'nodal-theme-swatch';
          sw.style.background = c;
          btn.appendChild(sw);
        });
        var label = document.createElement('span');
        label.className = 'nodal-theme-preset-label';
        label.textContent = preset.name;
        btn.appendChild(label);
        btn.addEventListener('click', function () { selectPreset(preset); });
        presetsEl.appendChild(btn);
      });
    }

    function selectPreset(preset) {
      var choice = { name: preset.name };
      applyChoice(choice);
      store(choice);
      renderPresets(preset.name);
    }

    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    launcher.addEventListener('click', function () {
      setOpen(panel.hidden);
    });

    document.addEventListener('click', function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        setOpen(false);
        launcher.focus();
      }
    });

    darkSchemeMq.addEventListener('change', function () {
      applyChoice(activeChoice); // same choice, re-resolved against the new scheme
      renderPresets(activeChoice ? activeChoice.name : null);
    });

    renderPresets(activeChoice ? activeChoice.name : null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPicker);
  } else {
    buildPicker();
  }
})();
