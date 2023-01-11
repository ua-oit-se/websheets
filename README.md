# Websheets
Websheets is a script that allows users to easily pull data from Google sheets and display it on a webpage. It is based
on [Sheetrock.js](https://chriszarate.github.io/sheetrock/).

## Design
Currently, the project is implemented entirely in one file with vanilla JS and documented with
[JSDoc](https://jsdoc.app/) style comments. As such, there is no build process. The published production script is the
same script that is kept in source control.

## Usage
When using this script, a Google sheet is needed to pull data from. This sheet must be publicly viewable in order for
the data to be accessible to the script.

In addition to the sheet that data will be pulled from, a template and a destination element is required. The template
is simply a function that returns an HTML string with the layout of the element for a given row - this can be made using
library such as [Handlebars](https://handlebarsjs.com/), or manually implemented. The destination element is the element
that the returned value from the template will be inserted into for each element.

Note that Sheetrock.js needs to be included in the page before the websheets script is, otherwise errors will appear.

### Examples

#### Basic
A basic example of usage can be seen below. This script pulls all data and displays it on the page with a simple
template.

[View example on Codepen](https://codepen.io/katlyn/pen/VwBpgwr?editors=1010)
```html
<div id="output"></div>
```
```js
function template (row) {
  // Generate a paragraph element for each row 
  return `<p>${row.name} works in ${row.department}</p>`
}

const sheet = new WebSheet({
  // This URL specifies the sheet to pull data from, it must be public and be the full URL including hash
  sheet: 'https://docs.google.com/spreadsheets/d/1LD3O8kTybgW9lqzz6zG2TvGAyDgVcpi2ORb7uQWRjfA/edit#gid=0',
  // The template function used to render our results
  template: template,
  // The output is the element that results from the template function will be appended into
  output: document.getElementById('output'),
  // The query determins what columsn we want to select
  query: `select A,B,C,D`,
  // These labels should match the order and names of the columns specified in the query
  labels: ['name', 'username', 'email', 'department'],
  // If an error is encountered, we use this to handle it gracefully
  errorCallback: err => {
    console.error(err)
  }
})

// Fetch the data from the sheet and populate the results
sheet.fetch()
```
#### Filters
More advanced functionality such as filtering can easily be implemented. The below example allows filtering columns by
text search on the name column, as well as filtering by department. Elements for filters must be placed onto the page
separate from the Websheet script. Any inputs will automatically be populated with values returned from the spreadsheet.

[View example on Codepen](https://codepen.io/katlyn/pen/xxJqMPX)
```html
<input type="text" name="name" id="name">
<select name="department" id="department"></select>
<div id="output"></div>
```
```js
function template (row) {
  return `<p>${row.name} works in ${row.department}</p>`
}

const sheet = new WebSheet({
  sheet: 'https://docs.google.com/spreadsheets/d/1LD3O8kTybgW9lqzz6zG2TvGAyDgVcpi2ORb7uQWRjfA/edit#gid=0',
  template: template,
  output: document.getElementById('output'),
  query: `select A,B,C,D`,
  labels: ['name', 'username', 'email', 'department'],
  errorCallback: err => {
    console.error(err)
  }
})

const nameInput = document.getElementById('name')
const departmentSelect = document.getElementById('department')

sheet
  // Use the nameInput to search in the name column
  .searchFilter(nameInput, ['name'])
  // Sepecify the column for departmentSelect to filter on
  .selectColumnFilter(departmentSelect, 'department')
  // Fetch and populate the results
  .fetch()
```

#### Sorting
Similar to filters, it is easy to populate and sort results based on specific columns. The following example allows
users to sort based on name, email, or department. Custom sort orders can also be implemented using a custom `compare`
function. The first specified sort function will be the one used by default. Currently only one sort select can be used
on a websheet. Static functions can also be added to the `WebSheet.sortingComparisons` array. Functions in this array
will be applied in order, before sorting from `setSortSelect` is applied.

[View example on Codepen](https://codepen.io/katlyn/pen/MWBpLqb)
```html
<select name="sortcol" id="sortcol"></select>
<div id="output"></div>
```
```js
function template (row) {
  return `<p>${row.name} works in ${row.department}</p>`
}

const sheet = new WebSheet({
  sheet: 'https://docs.google.com/spreadsheets/d/1LD3O8kTybgW9lqzz6zG2TvGAyDgVcpi2ORb7uQWRjfA/edit#gid=0',
  template: template,
  output: document.getElementById('output'),
  query: `select A,B,C,D`,
  labels: ['name', 'username', 'email', 'department'],
  errorCallback: err => {
    console.error(err)
  }
})

const sortSelect = document.getElementById('sortcol')

sheet
  .setSortSelect(sortSelect, [
    {
      // What this sorting option will be displayed as to the user
      label: 'Name',
      // The comparison function. Using WebSheet.columnSort generates a function to sort on the specified column.
      compare: WebSheet.columnSort('name')
    },
    {
      label: 'Department',
      compare: WebSheet.columnSort('department')
    }
  ])
  // Fetch and populate the results
  .fetch()
```

## Publishing Updates
When this repository is updated, the published and used version on the website is not updated automatically. The current
production version lives at https://uaf.edu/_resources/js/websheets.js, and needs to be updated through OmniCMS in order
for the changes to be applied across all UAF/Alaska sites using the script.

> **Warning**
> The file stored in OmniCMS should not be modified on its own. Make changes to this repository and publish them on
> OmniCMS after testing.
