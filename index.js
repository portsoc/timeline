// get a handle on envery element in the
// page for safe shorthand use

const UNIT = 24;
const DAY_MILLIS = 1000 * 60 * 60 * 24;
const el = {};

const vertOffset = 300; // todo auto adjust this

window.addEventListener('load', init);

function init() {
  document.querySelectorAll('[id]').forEach(e => { el[e.id] = e; });
  el.datefrom.addEventListener('change', redraw);
  el.dateto.addEventListener('change', redraw);
  el.daywidth.addEventListener('input', redraw);

  redraw();
}

function redraw() {
  const timelineData = gatherInputData();
  draw(timelineData);
}

function gatherInputData() {
  const retval = {};

  const dummyStart = new Date('2020-09-15');
  const dummyEnd = new Date('2021-05-07');

  retval.tasks = generateDummyTasks(dummyStart, dummyEnd);
  retval.keyDates = generateDummyKeyDates(dummyStart, dummyEnd);

  // calculate start/end date from the key and task dates
  const keyDates = retval.keyDates.map(k => k.date);
  const taskStartDates = retval.tasks.map(t => t.start);
  const taskEndDates = retval.tasks.map(t => t.end);

  retval.startDate = new Date(Math.min(...keyDates.concat(taskStartDates).map(d => Number(d))));
  retval.endDate = new Date(Math.max(...keyDates.concat(taskEndDates).map(d => Number(d))));

  console.log(keyDates.concat(taskStartDates));

  return retval;
}

function draw(data) {
  const firstDate = new Date(data.startDate.getFullYear(), data.startDate.getMonth(), 1);
  const lastDate = new Date(new Date(data.endDate.getFullYear(), data.endDate.getMonth() + 1, 1) - 24 * 60 * 60 * 1000);

  const dayWidth = el.daywidth.value / 4;

  const days = (lastDate - firstDate) / 1000 / 24 / 60 / 60 * dayWidth;
  const barHeight = UNIT * 2;
  const halfBarHeight = UNIT;
  const taskHeight = UNIT;
  const offset = UNIT * 0.6;
  const pad = UNIT * 0.1;

  document.documentElement.style.setProperty('--unit', UNIT + 'px');

  const width = days + 20 * UNIT;
  const height = 20 * UNIT;

  // create new SVG
  el.timeline.remove();
  el.timeline = svg('svg', {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  });
  el.timelinecontainer.append(el.timeline);

  const barEl = svg('path', {
    id: 'bar',
    d: `M0,${vertOffset} L${days},${vertOffset} L${days + halfBarHeight},${vertOffset + halfBarHeight} L${days},${vertOffset + barHeight} L0,${vertOffset + barHeight} z`,
  });
  el.timeline.append(barEl);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


  for (let monthStart = firstDate; monthStart < lastDate; monthStart = getNextMonthStart(monthStart)) {
    const text = MONTHS[monthStart.getMonth()];
    const monthMarker = svg('text', {
      transform: `translate(${dateX(monthStart) + offset},${vertOffset + barHeight - pad}) rotate(-45)`,
      class: 'month-marker',
    });
    // todo reconsider 15 above so dates align with months somehow
    monthMarker.textContent = text;
    el.timeline.append(monthMarker);
  }

  for (const task of data.tasks) {
    drawTask(task);
  }

  for (const keyDate of data.keyDates) {
    drawKeyDate(keyDate);
  }


  function drawTask(task) {
    const y = task.layer * taskHeight + vertOffset + barHeight + halfBarHeight;
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
    const textEl = svg('text', { x: x + pad, y: y + taskHeight / 2 + pad, style: `fill: ${task.color}` });
    textEl.textContent = task.name;
    g.append(barEl, textEl);
    el.timeline.append(g);
  }

  function drawKeyDate(keyDate) {
    const y = vertOffset;
    const x1 = dateX(keyDate.date);
    const g = svg('g', { class: 'key-date' });
    const style = keyDate.color ? `fill: ${keyDate.color}` : '';

    const dateEl = svg('text', { x: x1, y: y - taskHeight, style, class: 'date' });
    dateEl.textContent = keyDate.date.getDate();

    const nameEl = svg('text', {
      transform: `translate(${x1 + UNIT / 2},${y - taskHeight * 2}) rotate(-45)`,
      style,
    });
    nameEl.textContent = keyDate.name;

    g.append(dateEl, nameEl);
    el.timeline.append(g);
  }

  function dateX(date) {
    return dayDiff(firstDate, date) * dayWidth;
  }
}


function dayDiff(date1, date2) {
  return (date2 - date1) / 1000 / 24 / 60 / 60;
}

function getNextMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/*
  * create an SVG DOM element
  */
function svg(name, attributes = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const attr of Object.keys(attributes)) {
    el.setAttribute(attr, attributes[attr]);
  }
  return el;
}


function generateDummyTasks(startDate, endDate) {
  const tasks = [];
  tasks.push({
    name: 'one',
    start: startDate,
    end: new Date(Number(startDate) + 40 * DAY_MILLIS),
    bg: '#336699',
    color: '#FFF',
    layer: 0,
  });
  tasks.push({
    name: 'two',
    start: new Date(Number(startDate) + 40 * DAY_MILLIS),
    end: new Date(Number(startDate) + 80 * DAY_MILLIS),
    bg: '#339966',
    color: '#FFF',
    layer: 1,
  });
  tasks.push({
    name: 'three',
    start: new Date(Number(startDate) + 80 * DAY_MILLIS),
    end: endDate,
    bg: '#993366',
    color: '#FFF',
    layer: 0,
  });
  tasks.push({
    name: 'foo',
    start: startDate,
    end: new Date(Number(startDate) + (endDate - startDate)),
    bg: '#330099',
    color: '#0F0',
    layer: 3,
  });
  return tasks;
}

function generateDummyKeyDates(startDate, endDate) {
  const keyDates = [];
  keyDates.push({
    name: 'First',
    date: startDate,
    color: 'red',
  });
  keyDates.push({
    name: 'Something',
    date: new Date(Number(startDate) + 40 * DAY_MILLIS),
  });
  keyDates.push({
    name: 'Another Thing',
    date: new Date(Number(startDate) + 80 * DAY_MILLIS),
  });
  keyDates.push({
    name: 'Last Deadline',
    date: endDate,
  });
  return keyDates;
}
