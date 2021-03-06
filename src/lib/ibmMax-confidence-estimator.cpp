//*****************************************
//
// \file   ibmMax-confidence-estimator.cpp
// \author Vicent Alabau
// \author Jesús González-Rubio
// \brief  Confidence Measure plugin for casmacat
//
// Copyright (C) 2012
//_________________________________________

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <string>
#include "SmoothedIncrIbm1AligModel.h"
#include <cctype>
#include <algorithm>  

//#include <casmacat/config.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class IBMConfidencer: public IConfidenceEngine, Loggable {
  Logger *_logger;
  SmoothedIncrIbm1AligModel _ibm;
public:
  IBMConfidencer(): _logger(0) { }
  
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~IBMConfidencer() { LOG(INFO) << "IBMConfidencer am freed." << endl; };
	
  virtual float getWordConfidences(const vector<string> &source,
																	 const vector<string> &target,
																	 const vector<bool> &validated,
																	 vector<float> &confidences)
  {
		vector<WordIndex> srcSnt;
		vector<WordIndex> trgSnt;
    float nconf=0,nconf2=0;
		string aux;
    
    // snt-ize source and target 
    srcSnt.clear();
    for(unsigned int i=0; i<source.size(); ++i)
      srcSnt.push_back(_ibm.stringToSrcWordIndex(source[i]));
    
    trgSnt.clear();
    for(unsigned int i=0; i<target.size(); ++i)
			trgSnt.push_back(_ibm.stringToTrgWordIndex(target[i]));
		
		
    // clean and prepare the confidences vector
    confidences.clear();
    confidences.resize(trgSnt.size());
    
    // we implement max ibm1 
    // validated words have confidence == 1
    for(unsigned int i=0; i<trgSnt.size(); ++i){
			if(!validated[i]){
				confidences[i]=float(_ibm.pts(NULL_WORD,trgSnt[i]));
				for(unsigned int j=0; j<srcSnt.size(); ++j){
					nconf=float(_ibm.pts(srcSnt[j],trgSnt[i]));
					
					// Eufemistic E. is heuristic
					aux=target[i];
					if(isupper(aux[0]) && !isupper(aux[1])){
						transform(aux.begin(), (aux.begin())+1, aux.begin(), ::tolower );
						nconf2=_ibm.pts(srcSnt[j],_ibm.stringToTrgWordIndex(aux));
						if( nconf2 > nconf)
							nconf=nconf2;
					}
					aux=source[j];
					if(isupper(aux[0]) && !isupper(aux[1])){
						transform(aux.begin(), (aux.begin())+1, aux.begin(), ::tolower );
						nconf2=_ibm.pts(_ibm.stringToSrcWordIndex(aux),trgSnt[i]);
						if( nconf2 > nconf)
							nconf=nconf2;
					}
					// Confidence 1.0 for numbers
					if(atoi(target[i].c_str())!=0 && target[i]==source[j]) nconf=1.0;
						
					if ( nconf > confidences[i] ) confidences[i]=nconf;
				}
			}else
				confidences[i]=1.0;
    }
		
    return EXIT_SUCCESS;
  }

  virtual float getSentenceConfidence(const vector<string> &source,
                                      const vector<string> &target,
                                      const vector<bool> &validated)
  {
		vector<float> confidences;
		float nconf;
		
		getWordConfidences(source, target, validated, confidences);
		
		// score combination average
		nconf=0.0;
		for(unsigned int i=0; i<confidences.size(); ++i)
			nconf+=confidences[i];
		nconf/=confidences.size();
		
    return nconf;
  }
	
  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target) 
	{
		pair<unsigned int, unsigned int> sentRange;

		if(!source.empty() && !target.empty()){
			_ibm.addSentPair(source, target, 1, sentRange);
			_ibm.trainSentPairRange(sentRange,0);
			LOG(INFO) << "Updated with new bilingual pair" << endl; 
		} 
	}

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "IBMConfidencer is joining the logger";
  }
	
  // cargamos los modelos ibm a partir del prefijo de los ficheros
  int init(string filesPrefix)
  {
    
    LOG(INFO) << "Initializing confidencer..." << endl;
    _ibm.load(filesPrefix.c_str());
    
    return EXIT_SUCCESS;
  }

};



class IBMConfidenceFactory: public IConfidenceFactory {
  Logger *_logger;
  IBMConfidencer *rc;

public:
  IBMConfidenceFactory(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~IBMConfidenceFactory() {
    // TODO: delete rc here?;
    LOG(INFO) << "IBMConfidencer freed.";
    delete rc;
  };


  // creation and initialization of the CM
  // only the prefix of the files is required
  virtual int init(int argc, char *argv[], Context *context = 0) {
		if (argc != 2)
      return EXIT_FAILURE;
    
    rc = new IBMConfidencer();
    rc->init(argv[1]);
    rc->setLogger(_logger);
    
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return "IBMConfidencer"; }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "IBMConfidenceFactory is joining the logger";
  }

  virtual IConfidenceEngine *createInstance(const string &specialization_id = "") {
    //TODO: consider to generate one new based on specialization_id
    return rc;
  }
  virtual void deleteInstance(IConfidenceEngine *instance) {
    //delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(IConfidenceEngine, IBMConfidenceFactory);

