// get a handle on envery element in the
// page for safe shorthand use

const UNIT = 16; // default font size
const VERT_OFFSET = 300;
const BAR_HEIGHT = UNIT * 2.5;

const DAY_MILLIS = 1000 * 60 * 60 * 24;
const SVG_NS = 'http://www.w3.org/2000/svg';
const el = {};

const colours = [
  '#C4014B', '#E17300', '#76BE2A', '#00B482', '#E5007E', '#00A0FF',
  '#014BC4', '#7300E1', '#BE2A76', '#B48200', '#007EE5', '#A0FF00',
  '#4BC401', '#00E173', '#2A76BE', '#8200B4', '#7EE500', '#FF00A0',
];
let colourIndex = 0;

window.addEventListener('load', init);

function findFirstLayerWithSpace() {
  const tasks = el.tasklist.querySelectorAll('[name=layer]');
  let highest = -1;
  for (const task of tasks) {
    highest = Math.max(highest, task.valueAsNumber);
  }
  return (highest + 1) % 12;
}

function init() {
  document.querySelectorAll('[id]').forEach(e => { el[e.id] = e; });
  document.addEventListener('input', redraw);

  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', acceptDrop);

  redraw();
}

function kill(e) {
  e.target.parentElement.remove();
  redraw();
}

function addKeyDate(data) {
  if (data instanceof Event) data = null;

  const cloned = document.importNode(el.keydatetemplate.content, true).firstElementChild;
  cloned.id = getUnique();
  el.keydatelist.append(cloned);

  // data may be an event or an array
  if (data) {
    colourIndex = ((colourIndex + 1) % colours.length);
    cloned.querySelector('[name=name]').value = data.name;
    cloned.querySelector('[name=keydate]').valueAsDate = new Date(data.date);
    cloned.querySelector('[name=color]').value = data.color;
  } else {
    const dateFields = Array.from(el.keydatelist.querySelectorAll('[name=keydate]'));
    const lastDate = Math.max(...dateFields.map(el => Number(el.valueAsDate)));
    if (lastDate === -Infinity) {
      cloned.querySelector('[name=keydate]').value = el.datefrom.value;
    } else {
      cloned.querySelector('[name=keydate]').valueAsDate = new Date(lastDate + 28 * DAY_MILLIS);
    }
  }

  const buttons = el.keydatelist.querySelectorAll('button.delete');
  buttons[buttons.length - 1].addEventListener('click', kill);

  redraw();

  makeVisible(cloned);
}

function addTask(data) {
  if (data instanceof Event) data = null;
  const cloned = document.importNode(el.tasktemplate.content, true).firstElementChild;
  cloned.id = getUnique();
  el.tasklist.append(cloned);

  // data may be an event or an array
  if (data) {
    colourIndex = ((colourIndex + 1) % colours.length);
    cloned.querySelector('[name=name]').value = data.name;
    cloned.querySelector('[name=fg]').value = data.color;
    cloned.querySelector('[name=bg]').value = data.bg;
    cloned.querySelector('[name=from]').valueAsDate = new Date(data.start);
    cloned.querySelector('[name=to]').valueAsDate = new Date(data.end);
    cloned.querySelector('[name=layer]').value = data.layer;
  } else {
    colourIndex = ((colourIndex + 1) % colours.length);
    cloned.querySelector('[name=bg]').value = colours[colourIndex];
    cloned.querySelector('[name=from]').value = el.datefrom.value;
    cloned.querySelector('[name=to]').value = el.dateto.value;
    cloned.querySelector('[name=layer]').value = findFirstLayerWithSpace();
    redraw();
  }

  const buttons = el.tasklist.querySelectorAll('button.delete');
  buttons[buttons.length - 1].addEventListener('click', kill);

  makeVisible(cloned);
}

function redraw() {
  const timelineData = gatherInputData();
  el.timeline.remove();
  el.timeline = draw(timelineData, true);
  el.timelinecontainer.append(el.timeline);

  updateDownloadLink(draw(timelineData, false));
  updateDownloadJSONLink();
}

function gatherInputData() {
  const retval = {
    keyDates: [],
    tasks: [],
  };

  const tasks = document.querySelectorAll('#tasklist section');
  for (const taskform of tasks) {
    const task = {
      id: taskform.id,
      name: getNameValue(taskform, 'name'),
      start: new Date(getNameValue(taskform, 'from')),
      end: new Date(getNameValue(taskform, 'to')),
      bg: getNameValue(taskform, 'bg'),
      color: getNameValue(taskform, 'fg'),
      layer: getNameValue(taskform, 'layer'),
      link: getNameValue(taskform, 'link'),
    };
    retval.tasks.push(task);
  }

  const dates = document.querySelectorAll('#keydatelist section');
  for (const keydateform of dates) {
    const keydate = {
      id: keydateform.id,
      name: getNameValue(keydateform, 'name'),
      date: new Date(getNameValue(keydateform, 'keydate')),
      color: getNameValue(keydateform, 'color'),
      link: getNameValue(keydateform, 'link'),
    };
    retval.keyDates.push(keydate);
  }


  function getNameValue(elem, thing) {
    return elem.querySelector(`[name=${thing}`).value;
  }

  // calculate start/end date from the key and task dates
  const keyDates = retval.keyDates.map(k => k.date);
  const taskStartDates = retval.tasks.map(t => t.start);
  const taskEndDates = retval.tasks.map(t => t.end);

  const domStartDate = el.datefrom.valueAsDate;
  const domEndDate = el.dateto.valueAsDate;

  retval.startDate = new Date(Math.min(...keyDates.concat(taskStartDates, domStartDate).map(d => Number(d))));
  retval.endDate = new Date(Math.max(...keyDates.concat(taskEndDates, domEndDate).map(d => Number(d))));

  // todo find why the scale scales things more than expected
  retval.dayWidth = el.daywidth.valueAsNumber / 10;
  retval.baseColor = el.basecolor.value;

  return retval;
}

function draw(data, editControls) {
  const firstDate = new Date(data.startDate.getFullYear(), data.startDate.getMonth(), 1);

  const days = (data.endDate - firstDate) / DAY_MILLIS * data.dayWidth;

  const barHeight = BAR_HEIGHT;
  const halfBarHeight = barHeight / 2;
  const taskHeight = UNIT * 1.4;
  const taskStart = barHeight * 1.5;
  const taskPad = UNIT * 0.2;

  const addBtnHeight = UNIT * 9;

  const width = days + barHeight * 10;
  const vertOffset = VERT_OFFSET; // todo auto adjust this
  const leftOffset = barHeight;
  const taskLayers = Math.max(0, ...data.tasks.map(t => t.layer)) + 1;
  const tasksHeight = Math.max(taskHeight * taskLayers, addBtnHeight - taskStart + barHeight);
  const height = vertOffset + taskStart + tasksHeight + 2;
  const editControlsSize = editControls ? 5 * UNIT : 0;

  // create new SVG
  const drawing = svg('svg', {
    width: width + editControlsSize,
    height: height,
    viewBox: `${-barHeight - 2 - editControlsSize} ${-vertOffset} ${width + editControlsSize} ${height}`,
    xmlns: SVG_NS,
    style: `
      --unit: ${UNIT}px;
      --basecolor: ${data.baseColor};`,
  });


  // todo add clicking on the bar
  const barEl = svg('path', {
    id: 'bar',
    d: `M${-leftOffset},0 H${days + leftOffset} L${days + leftOffset + halfBarHeight},${halfBarHeight} L${days + leftOffset},${barHeight} H${-barHeight} z`,
  });
  drawing.append(barEl);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let monthStart = firstDate; monthStart <= data.endDate; monthStart = getNextMonthStart(monthStart)) {
    const text = MONTHS[monthStart.getMonth()];
    const monthMarker = svg('text', {
      transform: `translate(${dateX(monthStart)},${barHeight / 2}) rotate(-45)`,
      class: 'month-marker',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    monthMarker.textContent = text;
    drawing.append(monthMarker);
  }

  for (const task of data.tasks) {
    drawTask(task);
  }

  for (const keyDate of data.keyDates) {
    drawKeyDate(keyDate);
  }

  // if drawing with editControls, add those
  if (editControls) {
    const btnSize = editControlsSize - UNIT;

    const addKeyDateBtn = drawButton(-leftOffset - editControlsSize, -addBtnHeight - 2, btnSize, addBtnHeight, 'Add Key Date');
    addKeyDateBtn.addEventListener('click', addKeyDate);

    const addTaskBtn = drawButton(-leftOffset - editControlsSize, barHeight + 2, btnSize, addBtnHeight, 'Add Task');
    addTaskBtn.addEventListener('click', addTask);
  } else {
    // add the drawing to the document so sizing is available
    drawing.classList.add('temporary-svg');
    document.body.append(drawing);

    trimSVG(drawing);

    // drop from the document again
    drawing.remove();
    drawing.classList.remove('temporary-svg');
  }

  return drawing;

  function walkTreeToFindG(el) {
    if (el.tagName === 'svg') return null;
    if (el.tagName === 'a') return el;
    return walkTreeToFindG(el.parentElement);
  }

  function editThis(e) {
    e.preventDefault();
    // todo know better what's being edited
    // e.g. clicking on keydate's date should edit the date
    const g = walkTreeToFindG(e.target);
    const idInPage = g.id.substring(2);
    const elem = document.getElementById(idInPage);
    makeVisible(elem);
  }

  function drawButton(x, y, width, height, text) {
    const g = svg('g', { class: 'button' });
    const boxEl = svg('rect', {
      class: 'rect',
      x,
      y,
      width,
      height,
      rx: UNIT / 2,
    });
    const textEl = svg('text', {
      transform: `translate(${x + width / 2},${y + height / 2}) rotate(-90)`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    textEl.textContent = text;

    g.append(boxEl, textEl);
    drawing.append(g);
    return g;
  }

  function drawTask(task) {
    const y = taskStart + task.layer * taskHeight;
    const x = dateX(task.start);
    const width = dateX(task.end) - x;
    const anchor = svg('a', { id: 'g-' + task.id, class: 'task' });
    if (task.link) {
      anchor.setAttribute('href', task.link);
    }

    const barEl = svg('rect', {
      class: 'rect',
      x,
      y,
      width,
      height: taskHeight,
      rx: 4,
      fill: task.bg,
    });
    const textEl = svg('text', {
      x: x + taskPad,
      y: y + taskHeight / 2,
      style: `fill: ${task.color}`,
    });
    textEl.textContent = task.name;

    if (editControls) anchor.addEventListener('click', editThis);
    anchor.append(barEl, textEl);
    drawing.append(anchor);
  }

  function drawKeyDate(keyDate) {
    const y = 0;
    const x1 = dateX(keyDate.date);
    const anchor = svg('a', { id: 'g-' + keyDate.id, class: 'key-date' });
    if (keyDate.link) {
      anchor.setAttribute('href', keyDate.link);
    }


    const style = keyDate.color ? `fill: ${keyDate.color}` : '';

    const dateEl = svg('text', {
      x: x1,
      y: y - taskHeight,
      style,
      class: 'date',
      'text-anchor': 'middle',
    });
    dateEl.textContent = keyDate.date.getDate();

    const nameEl = svg('text', {
      transform: `translate(${x1},${y - taskHeight * 2}) rotate(-45)`,
      style,
    });
    nameEl.textContent = keyDate.name;

    if (editControls) anchor.addEventListener('click', editThis);
    anchor.append(dateEl, nameEl);
    drawing.append(anchor);
  }

  function dateX(date) {
    return dayDiff(firstDate, date) * data.dayWidth;
  }
}

function makeVisible(elem) {
  elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  elem.classList.add('highlight');
  setTimeout(() => { elem.classList.remove('highlight'); }, 2000);
  const firstInput = elem.querySelector('input');
  if (firstInput) {
    firstInput.focus();
    firstInput.select();
  }
}

function dayDiff(date1, date2) {
  return (date2 - date1) / DAY_MILLIS;
}

function getNextMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/*
  * create an SVG DOM element
  */
function svg(name, attributes = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const attr of Object.keys(attributes)) {
    el.setAttribute(attr, attributes[attr]);
  }
  return el;
}

let css;

async function updateDownloadLink(svgElement) {
  try {
    // load CSS if we haven't already
    if (css == null) {
      const response = await fetch('svg.css');
      if (response.ok) css = await response.text();
    }

    // add styling
    const clone = document.importNode(svgElement, true);
    const style = svg('style');
    style.textContent = css;
    clone.append(style);

    // now update the download URL
    let svgContent = clone.outerHTML;

    svgContent += '<!-- sEpArAtOr' + JSON.stringify(gatherInputData()) + 'sEpArAtOr -->';

    const encodedUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
    el.downloadsvg.href = encodedUri;
  } catch (e) {
    // could not get CSS (or some other problem)
    console.error(e);
    delete el.downloadsvg.href;
    el.downloadsvg.textContent = 'cannot download SVG';
    el.downloadsvg.title = 'cannot download SVG because CSS cannot be fetched';
    css = false;
  }
}

function updateDownloadJSONLink() {
  // remove IDs because they aren't useful in the JSON
  const data = gatherInputData();
  data.keyDates.forEach(obj => delete obj.id);
  data.tasks.forEach(obj => delete obj.id);

  const timelineData = JSON.stringify(data, null, 4);
  const encodedUri = 'data:application/javascript;charset=utf-8,' + encodeURIComponent(timelineData);
  el.downloadjson.href = encodedUri;
}


function getUnique() {
  const allowed = 'abcdefghijklmnopqrstuvwxyz';
  const replacer = () => allowed[Math.floor(Math.random() * allowed.length)];
  return 'xxx-xxx-xxx'.replace(/[x]/g, replacer);
}

function acceptDrop(e) {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f.type === 'application/json') {
    const reader = new FileReader();
    reader.onload = () => {
      addDataToUI(JSON.parse(reader.result));
    };
    reader.readAsText(f);
  }

  if (f.type === 'image/svg+xml') {
    const reader = new FileReader();
    reader.onload = () => {
      const parts = reader.result.split('sEpArAtOr');
      addDataToUI(JSON.parse(parts[1]));
    };
    reader.readAsText(f);
  }
}

function addDataToUI(data) {
  if (data.tasks) {
    for (const task of data.tasks) {
      console.log('adding', task);
      addTask(task);
    }
  }
  if (data.keyDates) {
    for (const kd of data.keyDates) {
      console.log('adding', kd);
      addKeyDate(kd);
    }
  }

  if (data.startDate) el.datefrom.valueAsDate = new Date(data.startDate);
  if (data.endDate) el.dateto.valueAsDate = new Date(data.endDate);
  if (data.baseColor) el.basecolor.value = data.baseColor;
  if (data.dayWidth) el.daywidth.value = data.dayWidth * 10;
  redraw();
}

// adjust the size and viewbox of the SVG element to actual contents
function trimSVG(svgEl) {
  const svgBCR = svgEl.getBoundingClientRect();
  let top = Infinity;
  let right = Infinity;
  let bottom = Infinity;
  let left = Infinity;
  for (const element of svgEl.children) {
    const elBCR = element.getBoundingClientRect();

    const elTopDist = elBCR.top - svgBCR.top;
    top = Math.min(top, elTopDist);

    const elBottomDist = svgBCR.bottom - elBCR.bottom;
    bottom = Math.min(bottom, elBottomDist);

    const elRightDist = svgBCR.right - elBCR.right;
    right = Math.min(right, elRightDist);

    const elLeftDist = elBCR.left - svgBCR.left;
    left = Math.min(left, elLeftDist);
  }

  top -= 2;
  bottom -= 2;
  right -= 2;
  left -= 2;

  svgEl.width.baseVal.value -= right + left;
  svgEl.viewBox.baseVal.width -= right + left;
  svgEl.viewBox.baseVal.x += left;

  svgEl.height.baseVal.value -= top + bottom;
  svgEl.viewBox.baseVal.height -= top + bottom;
  svgEl.viewBox.baseVal.y += top;
}
