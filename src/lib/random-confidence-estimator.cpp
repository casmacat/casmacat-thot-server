// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class RandomConfidencer: public IConfidenceEngine, Loggable {
  Logger *_logger;
public:
  RandomConfidencer(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomConfidencer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };


  virtual float getWordConfidences(const std::vector<std::string> &source,
                                  const std::vector<std::string> &target,
                                  const std::vector<bool> &validated,
                                  std::vector<float> &confidences)
  {
    LOG(INFO) << "I'm getting word confidences";
    confidences.resize(target.size());
    if (validated.empty() or validated.size() != target.size()) {
      for (size_t t = 0; t < target.size(); t++) {
        confidences[t] = rand() / double(RAND_MAX);
      }
    }
    else {
      for (size_t t = 0; t < target.size(); t++) {
        if (validated[t]) {
          confidences[t] = 1.0;
        }
        else {
          confidences[t] = rand() / double(RAND_MAX);
        }
      }
    }
    return rand() / double(RAND_MAX);
  }

  virtual float getSentenceConfidence(const std::vector<std::string> &source,
                                      const std::vector<std::string> &target,
                                      const std::vector<bool> &validated)
  {
    return rand() / double(RAND_MAX);
  }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }
};

class RandomConfidenceFactory: public IConfidenceFactory {
  Logger *_logger;
public:
  RandomConfidenceFactory(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomConfidenceFactory() {
    LOG(INFO) << "I, " << typeid(*this).name() <<  ", am free!!!";
  };

  virtual int init(int argc, char *argv[], Context *context = 0) {
    if (argc > 2) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    unsigned int seed = time(NULL);
    if (context and context->get<unsigned int>(string("seed")) != 0) {
        seed = *context->get<unsigned int>(string("seed"));
        cerr << typeid(*this).name() << " - retrieving seed from context: " << seed << "\n";
    }

    if (argc == 2) {
      seed = casmacat::convert_string<unsigned int>(string(argv[1]));
      if (not finite(seed)) { // check if initialization went wrong
        cerr << "Invalid seed = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
    }

    srand(seed);
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }
  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual IConfidenceEngine *createInstance(const std::string &specialization_id = "") {
    RandomConfidencer *rc = new RandomConfidencer();
    rc->setLogger(_logger);
    return rc;
  }

};


EXPORT_CASMACAT_PLUGIN(IConfidenceEngine, RandomConfidenceFactory);

