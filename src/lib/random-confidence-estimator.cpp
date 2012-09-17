// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/utils.h>

using namespace std;

class RandomConfidenceEstimator: public casmacat::IConfidenceEngine {
public:
  RandomConfidenceEstimator() { }

  virtual int init(int argc, char *argv[]) {
    if (argc > 2) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    unsigned int seed = time(NULL);
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

  virtual void getWordConfidences(const std::vector<std::string> &source,
                                  const std::vector<std::string> &target,
                                  const std::vector<bool> &validated,
                                  std::vector<float> &confidences)
  {
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
  }

  virtual float getSentenceConfidence(const std::vector<std::string> &source,
                                      const std::vector<std::string> &target,
                                      const std::vector<bool> &validated)
  {
    return rand() / double(RAND_MAX);
  }


  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomConfidenceEstimator() {}

};


EXPORT_CASMACAT_PLUGIN(IConfidenceEngine, RandomConfidenceEstimator);

