// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IDictionaryEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class RandomDictionary: public IDictionaryEngine, Loggable {
  Logger *_logger;
public:
  RandomDictionary(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomDictionary() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual void getWordOptions(const std::vector<std::string> &source,
                              const std::vector<std::string> &target,
                                     const std::vector<bool> &validated,
                                                      size_t word_idx,
                                    std::vector<std::string> &options,
                                          std::vector<float> &confidences)
  {
    LOG(INFO) << "I'm getting word options";
    options.clear();
    confidences.clear();

    for (size_t t = 0; t < 5; t++) {
      options.push_back(target[word_idx] + to_string(t));
      confidences.push_back(rand() / double(RAND_MAX));
    }
  }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "I'm joining the logger";
  }

  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target) {}

};

class RandomDictionaryFactory: public IDictionaryFactory {
  Logger *_logger;
public:
  RandomDictionaryFactory(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomDictionaryFactory() {
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

  virtual IDictionaryEngine *createInstance(const std::string &specialization_id = "") {
    RandomDictionary *rc = new RandomDictionary();
    rc->setLogger(_logger);
    return rc;
  }

  virtual void deleteInstance(IDictionaryEngine *instance) {
    delete instance;
  }

};


EXPORT_CASMACAT_PLUGIN(IDictionaryEngine, RandomDictionaryFactory);

