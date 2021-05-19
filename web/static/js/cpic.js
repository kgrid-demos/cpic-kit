// define the item component
Vue.component('recomtile', {
  template: '#recomtile-template',
  props: [
  	'recmodel',
    'reckey',
    'recindex',
    'library_url'
  ],
  data: function(){
    return {
      reclabel: {genes:"Based on",classification:"Classification of recommendations", content:"Dosing recommendations",implication:"Implications for phenotypic measures"}
    }
  },
  computed: {
    recrender: function() {
      var obj ={}
      var phenovalue = ''
      for(var key in this.recmodel.result.genes){
        if(phenovalue!=''){
          phenovalue = phenovalue+ " "
        }
        if(this.recmodel.result.genes[key].phenotype){
          if(this.recmodel.result.genes[key].phenotype!=''){
            phenovalue=phenovalue+key+" "+this.recmodel.result.genes[key].phenotype
          }
        } else {
          if(this.recmodel.result.genes[key].diplotype!=''){
            phenovalue=phenovalue+key+" "+this.recmodel.result.genes[key].diplotype
          }
        }
      }
      obj.genes=phenovalue
      obj.classification = this.recmodel.result.recommendation.classification
      obj.implication = this.recmodel.result.recommendation.implication
      obj.content=this.recmodel.result.recommendation.content
      return obj
    },
    objlink:function() {
      return this.library_url+"/#/object/"+(this.recmodel.info.ko.identifier.replace("ark:","").substring(1).replace(new RegExp('/', 'g'),'%2F'))
    }
  }
})

// boot up the demo
var demo = new Vue({
  el: '#app',
  data: function () {
  	return {
      currenturl:'',
      initdata: {},
      activatorurl: {'local': 'http://localhost:8080', 'default': 'https://activator.kgrid.org', 'custom': 'https://kgrid-activator.herokuapp.com'},
      selectedactivator: 'default',
      activatorselection: 'default',
      options: [
        { text: 'Default', url: 'https://activator.kgrid.org', value: 'default' },
    			{ text: 'Local', url: 'http://localhost:8080', value: 'local' },
          { text: 'Custom', url: 'https://kgrid-activator.herokuapp.com', value: 'custom'},
      ],
      libraryurl:{'local': 'http://localhost:8081', 'default': 'https://library.kgrid.org', 'custom': 'https://kgrid-library.herokuapp.com'},
      settingShow: false,
      autofillSelection: '',
      eventlog: [],
      activatorReady: false,
      phenoready: false,
      delay: 1500,
      genophenokolist: {},
      recommendationkolist: {},
      genopheno_endpoint: '',
      recommendation_endpoint: '',
      listrequest: {},
      genophenolookupko: {},
      druglookupko: {},
      logtext: {'request': 'K-GRID Service Request - Sending request to Knowledge Object ark:', 'response': ''},
      patientsamples: [],
      genophenopromises: [],
      drugpromises: [],
      phenotypePanel: {},
      diplotypePanel: {},
      currentstatus: '',
      recommendationlist: []
	  }
  },
  created: function () {
    var self = this
    axios.all([
      axios.get('./static/json/initdata.json'),
      axios.get('./static/json/config.json')
    ]).then(axios.spread(function (initresp, config) {
			  self.appendLog('app', 'Application Event - Loading Configuration...')
		    self.appendLog('app', 'Application Event - Loading Initial Data...')
        self.initdata = initresp.data
        self.listrequest = initresp.data.initrequest
        self.patientsamples = initresp.data.patientsamples
        self.phenotypePanel = JSON.parse(JSON.stringify(initresp.data.initrequest.diplotype))
        self.diplotypePanel = JSON.parse(JSON.stringify(initresp.data.initrequest.diplotype))
        self.genophenolookupko = config.data.genophenolookupko
        self.druglookupko = config.data.druglookupko
        self.genopheno_endpoint = config.data.genopheno_endpoint
        self.recommendation_endpoint = config.data.recommendation_endpoint
        // self.activatorurl.local=config.data.activator_url
        // self.options[1].url=config.data.activator_url
        self.currenturl=window.location.href
        // if(self.currenturl.includes('localhost')){
        self.selectedactivator='default'
        // }
        self.appendLog('app', 'Application Event - The Activator is set to '+self.baseUrl)
        axios.all([
          self.getdruglist,
          self.getg2pkolist
		 	  ]).then(axios.spread(function (druglist, genophenolist) {
           self.appendLog('app', self.logtext.request + self.genophenolookupko.id)
           self.appendLog('app', 'K-GRID Service Response - Geno to Pheno KO list returned from Knowledge Object ark:' + self.genophenolookupko.id)
      		 self.appendLog('app', self.logtext.request + self.druglookupko.id)
           self.appendLog('app', 'K-GRID Service Response - Gene drug table returned from Knowledge Object ark:' + self.druglookupko.id)
           self.appendLog('app', 'Demo App is Ready. Choose a sample patient genetic panel or manually enter the diplotypes.')
           self.recommendationkolist = druglist.data.result
           console.log(self.recommendationkolist)
           self.genophenokolist = genophenolist.data.result
           self.activatorReady=true
         })).catch(function (error) {
           self.appendLog('app', 'K-GRID Service Unavailable. Please use setting to change the activator url.')
           console.log(error)
         })
    })).catch(function (error) {
      console.log(error)
    })
  },
  computed: {
    baseUrl: function () {
      return this.activatorurl[this.selectedactivator]
    },
    librarybase: function(){
      return this.libraryurl[this.selectedactivator]
    },
    getdruglist: function () {
      return 	axios(
        {	url: this.baseUrl + this.druglookupko.id  + this.druglookupko.endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: this.listrequest.prescriptions
				})
    },
    getg2pkolist: function () {
      return 	axios(
				{	url: this.baseUrl + this.genophenolookupko.id + this.genophenolookupko.endpoint,
  				method: 'POST',
  				headers: {
  					'Content-Type': 'application/json'
  				},
  				data: this.listrequest.diplotype
		    })
    },
    debouncegetdata: function () {
      return _.debounce(this.getdata, this.delay)
    }
  },
  watch: {
    selectedactivator:function(){
      var self = this
      self.resetapp()
      Object.keys(self.diplotypePanel).forEach(function(key) {
        self.diplotypePanel[key] = ''
      })
      self.activatorReady=false
      axios.all([
        self.getdruglist,
        self.getg2pkolist
        ]).then(axios.spread(function (druglist, genophenolist) {
           self.appendLog('app', self.logtext.request + self.genophenolookupko.id)
           self.appendLog('app', 'K-GRID Service Response - Geno to Pheno KO list returned from Knowledge Object ark:' + self.genophenolookupko.id)
           self.appendLog('app', self.logtext.request + self.druglookupko.id)
           self.appendLog('app', 'K-GRID Service Response - Gene drug table returned from Knowledge Object ark:' + self.druglookupko.id)
           self.recommendationkolist = druglist.data.result
           self.genophenokolist = genophenolist.data.result

          self.activatorReady=true
   })).catch(function (error) {
     console.log(error)
   })
    },
    autofillSelection: function () {
      var self = this
      this.phenoready = false
      if (this.autofillSelection != '') {
        this.delay = 200
        var i = parseInt(this.autofillSelection)
        window.setTimeout(function () {
          self.autofill(i)
        }, 50)
        this.appendLog('app', 'Application Event - Autofill Sample #' + i + ' is selected.')
      }
    },
    diplotypePanel: {
      handler: function (after, before) {
        var ready = false
        var self = this
        this.resetapp()
        for (var key in this.diplotypePanel) {
          ready = ready || (this.diplotypePanel[key] != '')
        }
        if (ready) {
          this.debouncegetdata()
        }
      },
      deep: true
    },
    phenoready: function () {
      console.log('phenoready changed to ' + this.phenoready)
      if (this.phenoready) {
        this.getrecommendation()
      }
    }
  },
  methods: {
    showsetting: function () {
      this.settingShow = true
      this.activatorselection = this.selectedactivator
    },
    savesetting: function () {
      var temp = this.selectedactivator
      this.selectedactivator = this.activatorselection
      this.settingShow = false
      if (this.activatorselection != temp) {
        this.autofillSelection = ''
        this.resetapp()
        this.appendLog('app', 'Application Event - Switched the activator to: ' + this.baseUrl)
      }
    },
    appendLog: function (key, s) {
      var ts = moment().format('ddd, MMM Do YYYY, h:mm:ss A Z')
      var entry = {}
      entry.key = key
      entry.timestamp = ts
      entry.text = s
      this.eventlog.push(entry)
      this.scrollToEnd()
      this.currentstatus = s
    },
    resetapp: function () {
      var self=this
      this.phenoready = false
      this.recommendationlist = []
      Object.keys(this.phenotypePanel).forEach(function(key) {
        self.phenotypePanel[key] = {}
      })
    },
    autofill: function (i) {
      this.resetapp()
      this.diplotypePanel = JSON.parse(JSON.stringify(this.patientsamples[i].diplotype))
    },
    scrollToEnd: function () {
      var container = this.$el.querySelector('#statuslog')
      container.scrollTop = container.scrollHeight
    },
    getdata: function () {
      var self = this
      self.genophenopromises = []
      Object.keys(self.phenotypePanel).forEach(function(key){
        self.phenotypePanel[key] = {}
      })
      var i = parseInt(this.autofillSelection)
      for (var gene in self.diplotypePanel) {
        if (self.diplotypePanel[gene] != '' ) {
          if (self.genophenokolist[gene] != '') {
            self.appendLog('app', self.logtext.request + self.genophenokolist[gene])
            self.genophenopromises.push(self.postJsonReq(self.genophenokolist[gene] + self.genopheno_endpoint, self.diplotypePanel))
          }else {
            self.phenotypePanel[gene].diplotype=self.diplotypePanel[gene]
            self.phenotypePanel[gene].phenotype=''
          }
        }

      }
      axios.all(self.genophenopromises).then(function (results) {
        results.forEach(function (r) {
          console.log('pheno:')
          console.log(r)
          var phenotype = r.data.result
          Object.keys(phenotype).forEach(function(key) {
            self.phenotypePanel[key] = JSON.parse(JSON.stringify(phenotype[key]))
            self.appendLog('app', 'K-GRID Service Response - Phenotype result for ' + key + ' returned from ' + r.data.info.ko.identifier)
          })
        })
      }).then(function () {
        var ready = false
        Object.keys(self.phenotypePanel).forEach(function(key) {
          ready = ready || (self.phenotypePanel[key].phenotype != '')
        })
        self.phenoready = ready
      }).catch(function(error) {
        console.log(error)
      })
    },
    getrecommendation: function () {
      var self = this
      self.drugpromises = []
      self.recommendationlist = []
      var i = parseInt(this.autofillSelection)
      for (var drug in self.recommendationkolist) {
        if (self.recommendationkolist[drug] != '') {
          self.appendLog('app', self.logtext.request + self.recommendationkolist[drug])
          self.drugpromises.push(self.postJsonReq(self.recommendationkolist[drug] + self.recommendation_endpoint, self.phenotypePanel))
        }
      }
      axios.all(self.drugpromises).then(function (results) {
        results.forEach(function (r) {
          console.log('Drug:')
          console.log(r)
          var rec = r.data
          if (typeof (rec.result) === 'object') {
              self.recommendationlist.push(rec)
              self.appendLog('app', 'K-GRID Service Response - Recommendation result for ' + rec.result.drug + ' returned from ' + r.data.info.ko.identifier)
          } else {
            // self.appendLog('app', 'K-GRID Service Response - ' + rec.result + ' for ark:/' + r.data.info.ko)
          }
        })
      }).catch(function(error){
        console.log(error)
      })
    },
    postJsonReq: function (path, data) {
      return axios({
        method: 'post',
        url: this.baseUrl + path,
        headers: {'Content-Type': 'application/json'},
        data: data
      })
    }
  }
})
