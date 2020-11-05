// get a handle on envery element in the
// page for safe shorthand use

const UNIT = 16; // default font size
const DAY_MILLIS = 1000 * 60 * 60 * 24;
const el = {};

window.addEventListener('load', init);

function init() {
  document.querySelectorAll('[id]').forEach(e => { el[e.id] = e; });
  el.datefrom.addEventListener('change', redraw);
  el.dateto.addEventListener('change', redraw);
  el.daywidth.addEventListener('input', redraw);
  el.addkeydate.addEventListener('click', addKeyDate);
  el.addtask.addEventListener('click', addTask);
  redraw();
}

function addKeyDate() {
  const cloned = document.importNode(el.keydatetemplate.content, true);
  el.keydatelist.append(cloned);
}

function addTask() {
  const cloned = document.importNode(el.tasktemplate.content, true);
  el.tasklist.append(cloned);
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

  const dayWidth = el.daywidth.value / 4;

  const days = (data.endDate - firstDate) / DAY_MILLIS * dayWidth;

  const barHeight = UNIT * 2.5;
  const halfBarHeight = barHeight / 2;
  const taskHeight = UNIT * 1.4;
  const taskStart = barHeight * 1.5;
  const taskPad = UNIT * 0.2;

  document.documentElement.style.setProperty('--unit', UNIT + 'px');

  const width = days + barHeight * 10;
  const vertOffset = 300; // todo auto adjust this
  const taskLayers = Math.max(...data.tasks.map(t => t.layer)) + 1;
  const height = vertOffset + taskStart + taskHeight * taskLayers + 2;


  // create new SVG
  el.timeline.remove();
  el.timeline = svg('svg', {
    width,
    height: height,
    viewBox: `${-barHeight - 2} ${-vertOffset} ${width} ${height}`,
  });
  el.timelinecontainer.append(el.timeline);

  const barEl = svg('path', {
    id: 'bar',
    d: `M${-barHeight},0 H${days + barHeight} L${days + barHeight + halfBarHeight},${halfBarHeight} L${days + barHeight},${barHeight} H${-barHeight} z`,
  });
  el.timeline.append(barEl);

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
    el.timeline.append(monthMarker);
  }

  for (const task of data.tasks) {
    drawTask(task);
  }

  const keyDateSvgElements = [];
  for (const keyDate of data.keyDates) {
    keyDateSvgElements.push(drawKeyDate(keyDate));
  }

  // compute how far up and right the key dates go
  // this works only as long as CSS doesn't scale the SVG element
  const svgBCR = el.timeline.getBoundingClientRect();
  let top = vertOffset;
  let right = width;
  for (const keyDateEl of keyDateSvgElements) {
    const elBCR = keyDateEl.getBoundingClientRect();
    const elTopDist = elBCR.top - svgBCR.top;
    top = Math.min(top, elTopDist);
    const elRightDist = svgBCR.right - elBCR.right;
    right = Math.min(right, elRightDist);
  }

  el.timeline.setAttribute('width', width - right + 2);
  el.timeline.setAttribute('height', height - top + 2);
  el.timeline.setAttribute('viewBox',
    `${-barHeight - 2} ${-vertOffset + top - 2} ${width - right + 2} ${height - top + 2}`);


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
    el.timeline.append(g);
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
    el.timeline.append(g);
    return g;
  }

  function dateX(date) {
    return dayDiff(firstDate, date) * dayWidth;
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
