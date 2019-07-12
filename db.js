const fs = require('fs')

class db {
  constructor(filename) {
    this.filename = filename
  }

  get() {
    return fs.existsSync(this.filename) && fs.readFileSync(this.filename, 'utf-8')
      ? JSON.parse(fs.readFileSync(this.filename, 'utf-8'))
      : {}
  }

  set(obj) {
    fs.writeFileSync(this.filename, JSON.stringify(obj))
  }
}

module.exports = db
