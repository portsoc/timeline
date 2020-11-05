// get a handle on envery element in the
// page for safe shorthand use

const UNIT = 24;
const DAY_MILLIS = 1000*60*60*24;
const tasks = [];
const el = {};

window.addEventListener('load', init);

function init() {
  document.querySelectorAll("[id]").forEach( e => el[e.id] = e );
  el.datefrom.addEventListener("change", redraw);
  el.dateto.addEventListener("change", redraw);
  el.daywidth.addEventListener("input", redraw);
  redraw();
}


function redraw() {
  el.timeline.textContent = ''; // remove all content

  const startDate = el.datefrom.valueAsDate;
  const endDate = el.dateto.valueAsDate;

  addDummyTasks();

  const firstDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const lastDate = new Date(new Date(endDate.getFullYear(), endDate.getMonth()+1, 1)-24*60*60*1000);

  const dayWidth = el.daywidth.value/4;

  const days = (lastDate - firstDate) / 1000 / 24 / 60 / 60 * dayWidth;
  const barHeight = UNIT * 2;
  const halfBarHeight = UNIT ;
  const taskHeight = UNIT;
  const offset = UNIT * 0.6;
  const pad = UNIT * 0.1;

  document.documentElement.style.setProperty('--unit', UNIT + "px");

  const barEl = svg('path', {
    id: 'bar',
    d: `M0,100 L${days},100 L${days+halfBarHeight},${100+halfBarHeight} L${days},${100+barHeight} L0,${100+barHeight} z`,
  });
  el.timeline.append(barEl);

  const MONTHS = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];


  for (let monthStart = firstDate; monthStart < lastDate; monthStart = getNextMonthStart(monthStart)) {
    const text = MONTHS[monthStart.getMonth()];
    const monthMarker = svg('text', {
      transform: `translate(${dateX(monthStart)+offset},${100+barHeight-pad}) rotate(-45)`,
      class: 'month-marker'
    });
    // todo reconsider 15 above so dates align with months somehow
    monthMarker.textContent = text;
    el.timeline.append(monthMarker);
  }

  for (const task of tasks) {
    drawTask(task);
  }

  function drawTask(task) {
    const y = task.layer * taskHeight + 100 + barHeight + halfBarHeight;
    const x1 = dateX(task.start);
    const x2 = dateX(task.end);
    const g = svg('g', {class: 'task'});
    const barEl = svg('path', {
      class: 'task',
      d: `M${x1},${y} L${x2},${y} L${x2},${y+taskHeight} L${x1},${y+taskHeight} z`,
      fill: task.bg,
    });
    const textEl = svg('text', {x: x1+pad, y: y+taskHeight/2+pad, style: `fill: ${task.color}`});
    textEl.textContent = task.name; 
    g.append(barEl, textEl);
    el.timeline.append(g);
  }

  function dateX(date) {
    return dayDiff(firstDate, date)*dayWidth;
  }

  function addDummyTasks() {
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
      end: new Date(Number(startDate) + 80  * DAY_MILLIS),
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
  }
  

}


function dayDiff(date1, date2) {
  return (date2 - date1) / 1000 / 24 / 60 / 60;
}

function getNextMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth()+1, 1);
}

/*
  * create a DOM element
  * options can contain `id`, `classes`
  */
function svg(name, attributes = {}, classes = '') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const attr of Object.keys(attributes)) {
    el.setAttribute(attr, attributes[attr]);
  }
  return el;
}
