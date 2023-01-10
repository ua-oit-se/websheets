/**
 * Takes an array as input, and returns a filtered array according to the parameters passed.
 *  @callback webSheetFilterCallback
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
 * @callback webSheetSortFunction
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */

/**
 * @typedef webSheetSort
 * @type {object}
 * @property {string} label The text for the select option
 * @property {webSheetSortFunction} compare The column label to sort on
 */

/**
 * Called when the websheet encounters an error
 * @callback webSheetErrorFunction
 * @param {Error} error
 * @return {void}
 */

/**
 * @typedef webSheetOptions
 * @type {object}
 * @property {string} sheet The URL to the Google Sheet to pull data from
 * @property {HTMLElement|string|function} template The template to use when rendering results. Strings will automatically be compiled using Handlebars if possible.
 * @property {HTMLElement} output The node where filtered children should be output
 * @property {string} query The Google Visualization query language string used to select data
 * @property {string[]} labels Labels for the columns returned by the provided query
 * @property {webSheetErrorFunction?} errorCallback A function that will be called if an error is encountered
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
      throw new Error('WebSheet: Provide a Handlebars template')
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
     * @type {webSheetFilterCallback[]}
     */
    this.filters = []

    /**
     * Various input elements that will be sorted on and populated with options from the spreadsheet
     * @type {webSheetInput[]}
     */
    this.inputs = []

    if (typeof options.template === 'function') {
      /**
       * The compiled Handlebars template that we will use to populate the page.
       * @type {HandlebarsTemplateDelegate<any>}
       */
      this.template = options.template
    } else {
      this.template = Handlebars.compile(options.template.innerHTML ?? options.template)
    }

    this.errorCallback = options.errorCallback || console.error
  }

  /**
   * Add a new input element that will be watched and will trigger a rerender of elements when it's changed.
   * @param {webSheetFilterCallback} filterFunction
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
      this.errorCallback(err)
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
   * Return an array of rows that have been filtered and sorted according the user's applied filters
   * @returns {Array<object>}
   */
  get filteredRows () {
    let filteredRows = this.rows
    for (const filter of this.filters) {
      filteredRows = filter(filteredRows)
    }

    if (this.sorting != null) {
      const userSort = this.sorting.element.value
      const sortFunc = this.sorting.options.find(v => v.label === userSort)
      return [...filteredRows].sort(sortFunc.compare)
    }

    return filteredRows
  }

  /**
   * Generates an option element for each unique tag in a column, pulling data from this#inputs
   */
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

      // Clear out any old options from the select
      while (element.firstChild) {
        element.removeChild(element.firstChild)
      }

      // Populate the options into the select
      optArray.forEach(o => {
        const opt = document.createElement('option')
        opt.value = o
        opt.innerHTML = o === '' ? 'Not specified' : o
        element.appendChild(opt)
      })

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

  /**
   * Add a select to be autopopulated with sorting options
   * @param {HTMLSelectElement} element The select element to be populated
   * @param {webSheetSort[]} options
   * @returns WebSheet
   */
  setSortSelect(element, options) {
    element.addEventListener('input', this.populateResults.bind(this))

    for (const sort of options) {
      const el = document.createElement('option')
      el.innerText = sort.label
      el.value = sort.label
      element.append(el)
    }

    /**
     * Configuration for sorting the query results
     * @type {{options: webSheetSort[], element: HTMLSelectElement}}
     */
    this.sorting = {
      element,
      options
    }

    return this
  }

  /**
   * Generate a lexical sorting function for the specified column
   * @param col
   * @returns {(function(*, *): void)|*}
   */
  static columnSort(col) {
    return (a, b) => a[col].localeCompare(b[col])
  }
}
