var async = require('async')

var obj = {
  a: '1',
  b: '2',
  c: '3'
}

var arr = [1,2,3]

async.each(
  arr,
  function(o) {
    console.log(o)
  },
  function(err) {
    console.log('done')
  }
)