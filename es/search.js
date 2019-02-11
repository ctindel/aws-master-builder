async function search() {
    let es = require('elasticsearch').Client({
      hosts: [ 'https://search-ctindel-mb3-es2-i7lb3hukvelz4cvqlqumms2qly.us-east-2.es.amazonaws.com' ],
      connectionClass: require('http-aws-es')
    });
    
    await es.ping();

    const response = await es.search({
      index: 'product',
      type: '_doc',
      body: {
        query: {
          match_all: {}
        }
      }
    })
    
    for (const product of response.hits.hits) {
      console.log('product:', product);
    }
}

search()
