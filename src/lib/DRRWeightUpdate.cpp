#include <iostream>
#include <iomanip>
#include "drr.h"

#include "cdec/mteval/ns.h"
#include "cdec/utils/tdict.h"
#include "Eigen/Dense"
#include "Eigen/LU"

extern "C"
{
void *__dso_handle = NULL;
}

#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;
using namespace Eigen;

class DRRWeightUpdate: public WeightUpdateEngine, Loggable {
  Logger *_logger;
public: 
  DRRWeightUpdate(): _logger(0) { }
  DRR dr;
  
  virtual ~DRRWeightUpdate() {
    LOG(INFO) << "HMMAligner is now free!" << endl;
//     delete &aligModel;
  }
  
  virtual void updatelogWeights(const vector<double>& currentWeights,
                                string reference,
                                const vector<string>& nblist,
                                const vector<vector<double> >& scoreCompsVec,
                                vector<double> *newWeights;
                               ) {
//  vector<string> hyps;
//  for (int i=0;i<nblist.size();++i) hyps.push_back(nblist.second);
  dr.computeNewWeights(currentWeights, reference, nblist, scoreCompsVec, newWeights);
  }
  
  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "DRRWeightUpdate is joining the logger!" << endl;
  }

  int init(double alfa, double beta) {
    dr.setAlpha(alfa); dr.setBeta(beta);
    LOG(INFO) << "DRR log-linear weight update module initialised with alpha=" << alfa << ", and beta=" << beta << endl;
    return EXIT_SUCCESS;
  }
};

class DRRWeightUpdateFactory: public WeightUpdateFactory {
  Logger *_logger;
  DRRWeightUpdate *dwu;
public:
  DRRWeightUpdateFactory(): _logger(0) { };
  virtual ~DRRWeightUpdateFactory() { 
    LOG(INFO) << "DRRWeightUpdate is free!" << endl;
  };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc!=3) {
      cerr << "Invalid number of arguments for initialization of the weight updater!\nReceived: " << argv[1] << endl;
      return EXIT_FAILURE;
    }
    dwu = new DRRWeightUpdate();
    dwu->init(atof(argv[1]),atof(argv[2]));
    dwu->setLogger(_logger);
    
    return EXIT_SUCCESS;
  }
    
  virtual string getVersion() { return "DRR Weight Update"; }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "DRRWeightUpdate is joining the logger!" << endl;
  }
  
  virtual DRRWeightUpdate *createInstance(const std::string &specialization_id = "") {
    return dwu;
  }
};


EXPORT_CASMACAT_PLUGIN(DRRWeightUpdate, DRRWeightUpdateFactory);
