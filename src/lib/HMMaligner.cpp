#include <iostream>
#include <iomanip>
#include "IncrHmmAligModel.h"

#include <casmacat/IAlignmentEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class HMMAligner: public IAlignmentEngine, Loggable {
  IncrHmmAligModel aligModel;
  Logger *_logger;
public:
  HMMAligner(): _logger(0) { }

  virtual ~HMMAligner() {
    LOG(INFO) << "HMMAligner is now free!" << endl;
//     delete &aligModel;
  }

  virtual void align(const vector<string> &source,
                       const vector<string> &target,
                       vector< vector<float> > &alignments
                     ) {
      WordAligMatrix w;
      if (source.size() == 0 || target.size() == 0) {
        LOG(INFO) << "WARNING: HMMAligner received an empty source or target sentence!!" << endl << "WARNING: Returning empty alignment matrix!" << endl;
        alignments.resize(0);
        return;
      }
      aligModel.obtainBestAlignment( aligModel.strVectorToSrcIndexVector(source), aligModel.strVectorToTrgIndexVector(target), w );

      alignments.resize(source.size());
      for (size_t s=0; s<source.size(); ++s) {
	alignments[s].resize(target.size());
	for (size_t t=0; t<target.size(); ++t) {
	  alignments[s][t] = w.getValue(s,t);
	}
      }
  }

  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target) {}

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "IBMAligner is joining the logger!" << endl;
  }

  int init(char* filesPrefix) {
    if (aligModel.load(filesPrefix) == 0) { // 0 means OK
      LOG(INFO) << "Alignment model with prefix " << filesPrefix << "was loaded successfully!" << endl;
    } else {
      LOG(ERROR) << "Unable to open alignment model with prefix " << filesPrefix << endl;
      return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
  }
};

class HMMAlignerFactory: public IAlignmentFactory {
  Logger *_logger;
  HMMAligner *ha;
public:
  HMMAlignerFactory(): _logger(0) { };
  virtual ~HMMAlignerFactory() {
    LOG(INFO) << "HMMAligner is free!" << endl;
//     delete ha;
  };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc!=2) {
      cerr << "Invalid number of arguments for initialization of the aligner!\nReceived: " << argv[1] << endl;
      return EXIT_FAILURE;
    }
    ha = new HMMAligner();
    ha->init(argv[1]);
    ha->setLogger(_logger);

    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return "HMM Aligner"; }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "HMMAligner is joining the logger!" << endl;
  }

  virtual IAlignmentEngine *createInstance(const std::string &specialization_id = "") {
    return ha;
  }
  virtual void deleteInstance(IAlignmentEngine *instance) {
    delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(IAlignmentEngine, HMMAlignerFactory);
