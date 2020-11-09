// get a handle on envery element in the
// page for safe shorthand use

const UNIT = 16; // default font size
const DAY_MILLIS = 1000 * 60 * 60 * 24;
const SVG_NS = 'http://www.w3.org/2000/svg';
const el = {};

const colours = [
  '#C4014B', '#E17300', '#76BE2A', '#00B482', '#E5007E', '#00A0FF',
  '#014BC4', '#7300E1', '#BE2A76', '#B48200', '#007EE5', '#A0FF00',
  '#4BC401', '#00E173', '#2A76BE', '#8200B4', '#7EE500', '#FF00A0',
];
let colourIndex = 0;
let uid = 0;

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
  document.addEventListener('change', redraw);
  el.addkeydate.addEventListener('click', addKeyDate);
  el.addtask.addEventListener('click', addTask);
  redraw();
}

function kill(e) {
  e.target.parentElement.parentElement.remove();
  redraw();
}

function addKeyDate() {
  const cloned = document.importNode(el.keydatetemplate.content, true);

  const dateFields = Array.from(el.keydatelist.querySelectorAll('[name=keydate]'));
  const lastDate = Math.max(...dateFields.map(el => Number(el.valueAsDate)));
  if (lastDate === -Infinity) {
    cloned.querySelector('[name=keydate]').value = el.datefrom.value;
  } else {
    cloned.querySelector('[name=keydate]').valueAsDate = new Date(lastDate + 28 * DAY_MILLIS);
  }

  el.keydatelist.append(cloned);

  const buttons = el.keydatelist.querySelectorAll('button.delete');
  buttons[buttons.length - 1].addEventListener('click', kill);

  redraw();
}

function addTask() {
  const cloned = document.importNode(el.tasktemplate.content, true);

  colourIndex = ((colourIndex + 1) % colours.length);
  cloned.querySelector('[name=bg]').value = colours[colourIndex];
  cloned.querySelector('[name=from]').value = el.datefrom.value;
  cloned.querySelector('[name=to]').value = el.dateto.value;
  cloned.querySelector('[name=layer]').value = findFirstLayerWithSpace();

  el.tasklist.append(cloned);

  const buttons = el.tasklist.querySelectorAll('button.delete');
  buttons[buttons.length - 1].addEventListener('click', kill);

  redraw();
}

function redraw() {
  const timelineData = gatherInputData();
  el.timeline.remove();
  el.timeline = draw(timelineData);
  updateDownloadLink(el.timeline);
  el.timelinecontainer.append(el.timeline);
}

function gatherInputData() {

  const retval = {
    keyDates: [],
    tasks: [],
  };

  //  retval.tasks = generateDummyTasks(dummyStart, dummyEnd);
  const tasks = document.querySelectorAll('#tasklist section');
  for (const taskform of tasks) {
    const task = {
      name: getNameValue(taskform, 'name'),
      start: new Date(getNameValue(taskform, 'from')),
      end: new Date(getNameValue(taskform, 'to')),
      bg: getNameValue(taskform, 'bg'),
      color: getNameValue(taskform, 'fg'),
      layer: getNameValue(taskform, 'layer'),
    };
    retval.tasks.push(task);
  }

  // retval.keyDates = generateDummyKeyDates(dummyStart, dummyEnd);
  const dates = document.querySelectorAll('#keydatelist section');
  for (const keydateform of dates) {
    const keydate = {
      name: getNameValue(keydateform, 'name'),
      date: new Date(getNameValue(keydateform, 'keydate')),
      color: getNameValue(keydateform, 'color'),
    };
    console.log(keydate.color);
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

  retval.dayWidth = el.daywidth.value / 4;
  retval.baseColor = el.basecolor.value;

  return retval;
}

function draw(data) {
  const firstDate = new Date(data.startDate.getFullYear(), data.startDate.getMonth(), 1);

  const days = (data.endDate - firstDate) / DAY_MILLIS * data.dayWidth;

  const barHeight = UNIT * 2.5;
  const halfBarHeight = barHeight / 2;
  const taskHeight = UNIT * 1.4;
  const taskStart = barHeight * 1.5;
  const taskPad = UNIT * 0.2;

  document.documentElement.style.setProperty('--unit', UNIT + 'px');
  document.documentElement.style.setProperty('--basecolor', data.baseColor);

  const width = days + barHeight * 10;
  const vertOffset = 300; // todo auto adjust this
  const taskLayers = Math.max(0, ...data.tasks.map(t => t.layer)) + 1;
  const height = vertOffset + taskStart + taskHeight * taskLayers + 2;


  // create new SVG
  const drawing = svg('svg', {
    width,
    height: height,
    viewBox: `${-barHeight - 2} ${-vertOffset} ${width} ${height}`,
    xmlns: SVG_NS,
  });

  const barEl = svg('path', {
    id: 'bar',
    d: `M${-barHeight},0 H${days + barHeight} L${days + barHeight + halfBarHeight},${halfBarHeight} L${days + barHeight},${barHeight} H${-barHeight} z`,
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

  const keyDateSvgElements = [];
  for (const keyDate of data.keyDates) {
    keyDateSvgElements.push(drawKeyDate(keyDate));
  }

  computeBR(drawing);

  return drawing;


  // compute how far up and right the key dates go
  // this works only as long as CSS doesn't scale the SVG element
  function computeBR(drawing) {
    const svgBCR = drawing.getBoundingClientRect();
    let top = vertOffset;
    let right = width;
    if (keyDateSvgElements.length > 0) {
      for (const keyDateEl of keyDateSvgElements) {
        const elBCR = keyDateEl.getBoundingClientRect();
        const elTopDist = elBCR.top - svgBCR.top;
        top = Math.min(top, elTopDist);
        const elRightDist = svgBCR.right - elBCR.right;
        right = Math.min(right, elRightDist);
      }
      drawing.setAttribute('width', width - right + 2);
      drawing.setAttribute('height', height - top + 2);
      drawing.setAttribute('viewBox',
        `${-barHeight - 2} ${-vertOffset + top - 2} ${width - right + 2} ${height - top + 2}`);
    }
  }


  function drawTask(task) {
    const y = taskStart + task.layer * taskHeight;
    const x = dateX(task.start);
    const width = dateX(task.end) - x;
    const g = svg('g', { class: 'task' });
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
    g.append(barEl, textEl);
    drawing.append(g);
  }

  function drawKeyDate(keyDate) {
    const y = 0;
    const x1 = dateX(keyDate.date);
    const g = svg('g', { class: 'key-date' });
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

    g.append(dateEl, nameEl);
    drawing.append(g);
    return g;
  }

  function dateX(date) {
    return dayDiff(firstDate, date) * data.dayWidth;
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
      const response = await fetch('style.css');
      if (response.ok) css = await response.text();
    }

    // add styling
    const clone = document.importNode(svgElement, true);
    const style = svg('style');
    style.textContent = css;
    clone.append(style);

    // now update the download URL
    const svgContent = clone.outerHTML;
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



// todo - use if we want to do clickable image elements
// function getUnique() {
//   const allowed = 'abcdefghijklmnopqrstuvwxyz';
//   const replacer = c => c & allowed[Math.floor(Math.random() * allowed.length)];
//   return 'xxx-xxx-xxx'.replace(/[x]/g, replacer);
// }