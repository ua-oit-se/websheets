/**
 * Takes an array as input, and returns a filtered array according to the parameters passed.
 *  @callback filterCallback
 *  @template T
 *  @param {Array.<T>} items
 *  @return {Array.<T>}
 */

/**
 * @typedef webSheetInput
 * @type {object}
 * @property {HTMLInputElement | HTMLSelectElement} element
 * @property {string} column
 * @property {string|null} [deliminator]
 */

/**
 * @typedef webSheetOptions
 * @type {object}
 * @property {string} sheet The URL to the Google Sheet to pull data from
 * @property {HTMLScriptElement} template The Handlebars.JS template to use when rendering results
 * @property {HTMLElement} output The node where filtered children should be output
 * @property {string} query The Google Visualization query language string used to select data
 * @property {string[]} labels Labels for the columns returned by the provided query
 */

/**
 * Utility class that allows fetching data from a Google Sheet, and displaying it on a webpage with filters and sorting.
 */
class WebSheet {
  /**
   * Create a new WebSheet
   * @param {webSheetOptions} options
   */
  constructor(options) {
    if (options.sheet == null) {
      throw new Error('WebSheet: Provide a Google Sheet URL')
    }
    if (options.template == null) {
      throw new Error('WebSheet: Provide a Google Sheet URL')
    }
    if (options.query == null) {
      throw new Error('WebSheet: Provide a query')
    }
    if (options.labels == null) {
      throw new Error('WebSheet: Provide a list of labels for your selected rows')
    }

    /**
     * The options that this WebSheet was created with
     * @type {webSheetOptions}
     */
    this.options = options

    /**
     * Filters that will be applied to the output of this WebSheet
     * @type {filterCallback[]}
     */
    this.filters = []

    /**
     * Various input elements that will be sorted on and populated with options from the spreadsheet
     * @type {webSheetInput[]}
     */
    this.inputs = []

    /**
     * The compiled Handlebars template that we will use to populate the page.
     * @type {HandlebarsTemplateDelegate<any>}
     */
    this.template = Handlebars.compile(options.template.innerHTML)
  }

  /**
   * Add a new input element that will be watched and will trigger a rerender of elements when it's changed.
   * @param {filterCallback} filterFunction
   * @returns {WebSheet}
   */
  createFilter (filterFunction) {
    if (typeof filterFunction !== 'function') {
      throw new Error('WebSheet(addSearchFilter): Provide a valid HTML text input')
    }
    this.filters.push(filterFunction)
    return this
  }

  fetch () {
    sheetrock({
      target: this.options.output,
      url: this.options.sheet,
      query: this.options.query,
      callback: this.sheetrockCallback.bind(this),
      labels: this.options.labels,
      reset: true
    })
    return this
  }

  sheetrockCallback (err, options, response) {
    if (err) {
      console.error(err)
      return
    }

    /**
     * The array of rows from the spreadsheet
     * @type {Object[]}
     */
    // Check if the first row of the results matches the column labels that we were given. If it does, remove it.
    // NOTE: We do not have control over the column names or if this row will even be returned. THis is the best we can
    // do to work around it.
    this.rows = response.rows.map(r => r.cells).filter(r => this.options.labels.every(l => l !== r[l]))

    // Update the contents of the inputs and results with the
    this.populateInputs()
    this.populateResults()
  }

  /**
   * Return an array of rows that have been filtered according the user's applied filters
   * @returns {Array<object>}
   */
  get filteredRows () {
    let filteredRows = this.rows
    for (const filter of this.filters) {
      filteredRows = filter(filteredRows)
    }

    return filteredRows
  }

  // TODO: Implement auto-population of input elements
  populateInputs () {
    for (const { column, deliminator, element } of this.inputs) {
      let selectionBackup = element.value
      if (element.options.length === 0) {
        selectionBackup = 'Any'
      }

      const options = new Set()

      for (const row of this.rows) {
        // If there's no deliminator, we can just add the string values directly to the set
        if (deliminator == null) {
          options.add(row[column])
          continue
        }

        const values = row[column].split(deliminator)
        for (const value of values) {
          options.add(value.trim())
        }
      }

      // Perform a lexicographical sort on all options before adding them to the page
      const optArray = [...options].sort()
      // Add any option to the start of the array
      optArray.unshift('Any')

      optArray.forEach(o => {
        const opt = document.createElement('option')
        opt.value = o
        opt.innerHTML = o === '' ? 'Not specified' : o
        element.appendChild(opt)
      })

      console.log(selectionBackup, element.options)
      if (Array.from(element.options).find(o => o.value === selectionBackup) === undefined) {
        element.value = 'Any'
        continue
      }
      element.value = selectionBackup
    }
  }

  /**
   * Render and replace all previous elements with freshly filtered elements
   */
  populateResults () {
    let newInner = ''
    for (const row of this.filteredRows) {
      newInner += this.template(row)
    }
    this.options.output.innerHTML = newInner
  }

  /**
   * Create a filter from an input element that filters on the selected column.
   * Note: use WebSheet.populateInput() to initialize the values of a select input.
   * @param {HTMLSelectElement} element An HTML input or select element that will be used to filter this value
   * @param {string} column The name of the column to be filtered on
   * @param {string} [separator=null] The separator if the column contains a list of character-delimited values
   */
  selectColumnFilter(element, column, separator) {
    console.log('Adding input', element)
    // Add an event listener that will rerender the list of results when the select's value is changed
    element.addEventListener('change', this.populateResults.bind(this))
    this.createFilter(rows => {
      const selectedValue = element.value
      if (selectedValue === 'Any') {
        return rows
      }

      // If no separator is defined, filter on plain string value
      if (separator == null) {
        return rows.filter(r => r[column] === selectedValue)
      }

      // Check if any of the delimited values in the column are equal to the selected value
      return rows.filter(row => {
        return row[column].split(separator).findIndex(v => v.trim() === selectedValue) !== -1
      })
    })

    this.inputs.push({
      column,
      element,
      deliminator: separator
    })

    return this
  }

  /**
   * Add a search box that will filter based on the specified columns
   * @param {HTMLInputElement} element The
   * @param {string[]} columns
   */
  searchFilter(element, columns) {
    element.addEventListener('input', this.populateResults.bind(this))
    this.createFilter(rows => {
      const searchString = element.value.trim().toLowerCase()

      // If the search string is empty, short circuit the filter
      if (searchString === '') {
        return rows
      }

      return rows.filter(r => {
        // Check if any of the provided columns contain the search string
        return columns.findIndex(col => {
          return r[col].toLowerCase().includes(searchString)
        }) !== -1
      })
    })

    return this
  }
}
