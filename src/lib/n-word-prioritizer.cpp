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

#include <casmacat/config.h>
#include <casmacat/IWordPriorityEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

#include "SmoothedIncrIbm1AligModel.h"

using namespace std;
using namespace casmacat;


size_t suffixIdxStart(const std::vector<bool> &validated) {
  int i = validated.size() - 1; 
  for (;i >= 0; --i) {
    if (validated[i]) break;
  }
  return i + 1;
}

/********************************************************
 **  Confidence prioritizer:
 **   returns a suffix prioritized by a 
 **   fixed number of words
 ********************************************************/
class NWordPrioritizer: public IWordPriorityEngine, Loggable {
  size_t _n_word_len;
  Logger *_logger;
public:
  NWordPrioritizer(int n_word_len = 1): _n_word_len(n_word_len), _logger(0) { 	
		LOG(INFO) << "n_word_len " << _n_word_len << endl; 
	}
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~NWordPrioritizer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };


  virtual void getWordPriorities(const std::vector<std::string> &source,
                                 const std::vector<std::string> &target,
                                 const std::vector<bool> &validated,
                                       std::vector<int> &priorities)
  {
    priorities.resize(target.size());

    size_t i = suffixIdxStart(validated);
    std::fill(priorities.begin(), priorities.begin() + i, 0);

    int priority = 1; 
    size_t count = 0;
    for (; i < priorities.size(); i++) {
      priorities[i] = priority;
      count++;
      if (count == _n_word_len) {
        count = 0;
        priority++;
      } 
    }
  }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target) {}

};



/********************************************************
 **  Confidence prioritizer:
 **   returns a suffix prioritized by a 
 **   fixed number of wrong words
 ********************************************************/
class ConfidenceNWordPrioritizer: public IWordPriorityEngine, Loggable {
  size_t _n_word_len;
  SmoothedIncrIbm1AligModel _ibm;
	float _threshold;
  Logger *_logger; 
	
	void computeWordConfidences(const std::vector<std::string> &source,
															const std::vector<std::string> &target,
															const std::vector<bool>        &validated,
															      std::vector<float>       &confidences){
		vector<WordIndex> srcSnt;
		vector<WordIndex> trgSnt;

		// snt-ize source and target 
    srcSnt.clear();
    for(unsigned int i=0; i<source.size(); ++i) srcSnt.push_back(_ibm.stringToSrcWordIndex(source[i]));
    
		trgSnt.clear();
    for(unsigned int i=0; i<target.size(); ++i) trgSnt.push_back(_ibm.stringToTrgWordIndex(target[i]));

		//clear and resize confidences vector
		confidences.clear();
    confidences.resize(trgSnt.size());
    
    // we implement max ibm1 
    // validated words have confidence == 1
		float nconf=0,nconf2=0;
		string aux;
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
	}

public:
  ConfidenceNWordPrioritizer(int n_word_len = 1, float threshold = 0.03, std::string filesPrefix = ""): _logger(0) 
	{ 
		_n_word_len=n_word_len;
		LOG(INFO) << "n_word_len " << _n_word_len << endl;

		if (filesPrefix!=""){
			LOG(INFO) << "Initializing confidencer..." << endl;
			_ibm.load(filesPrefix.c_str());
		}else{
			LOG(INFO) << "No confidence model found in: " << filesPrefix << endl;
		}
 
		_threshold=threshold;
		LOG(INFO) << "threshold " << _threshold << endl;
	}

  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~ConfidenceNWordPrioritizer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };


  virtual void getWordPriorities(const std::vector<std::string> &source,
                                 const std::vector<std::string> &target,
                                 const std::vector<bool>        &validated,
                                       std::vector<int>         &priorities)
  {
		//compute confidences
		std::vector<float> confidences;
		computeWordConfidences(source, target, validated, confidences);


		// prepare the priorities vector
    priorities.resize(target.size());

    size_t i = suffixIdxStart(validated);
    std::fill(priorities.begin(), priorities.begin() + i, 0);


		int priority = 0; 
    size_t count = 0;
    for (; i < priorities.size(); i++) {
      if (confidences[i] < _threshold) count++;
      
			if (count == _n_word_len) {
        count = 0;
        priority++;
      } 
      priorities[i] = priority;
    }
  }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
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

};



/********************************************************
 **  Factory
 ********************************************************/
class NWordPriorityFactory: public IWordPriorityFactory {
  size_t      _n_word_len;
	float       _threshold;
	std::string _confidence_prefix;
  Logger      *_logger;
public:
  NWordPriorityFactory(): _n_word_len(1), _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~NWordPriorityFactory() {
    LOG(INFO) << "I, " << typeid(*this).name() <<  ", am free!!!";
  };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc<2 || argc > 4 || argc == 3) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    /* use context to store or retrieve objects from other modules
       remember that the one that sets the object is the _owner_, i.e.,
       the one responsible of freeing the resources (delete, etc)
    if (context and context->get<unsigned int>(string("confidenceIbm1Model")) != 0) {
        ibm = *context->get<unsigned int>(string("confidenceIbm1Model"));
        cerr << typeid(*this).name() << " - retrieving confidenceIbm1Model from context: " << seed << "\n";
				}
		*/
    
    if (argc == 2) {
      _n_word_len = casmacat::convert_string<int>(string(argv[1]));
      if (not finite(_n_word_len)) { // check if initialization went wrong
        cerr << "Invalid n word len = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
    }
		if (argc == 4) {
      _n_word_len = casmacat::convert_string<int>(string(argv[1]));
      if (not finite(_n_word_len)) { // check if initialization went wrong
        cerr << "Invalid n word len = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
			
			_threshold = casmacat::convert_string<float>(string(argv[2]));
      if (not finite(_threshold)) { // check if initialization went wrong
        cerr << "Invalid n word len = '" << argv[2] << "'\n";
        return EXIT_FAILURE;
      }

			_confidence_prefix = string(argv[3]);
    }

    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }
  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual IWordPriorityEngine *createInstance(const std::string &specialization_id = "") {
		// TODO: create different instances according to specialization_id
    if (_confidence_prefix.empty()) {
      NWordPrioritizer *rc = new NWordPrioritizer(_n_word_len);
  		rc->setLogger(_logger);
  		return rc;
    }
    else {
  		ConfidenceNWordPrioritizer *rc = new ConfidenceNWordPrioritizer(_n_word_len,_threshold,_confidence_prefix);
  		rc->setLogger(_logger);
  		return rc;
    }
  }

  virtual void deleteInstance(IWordPriorityEngine *instance) {
    delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(IWordPriorityEngine, NWordPriorityFactory);

