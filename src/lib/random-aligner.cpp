#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/config.h>
#include <casmacat/IAlignmentEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class RandomAligner: public IAlignmentEngine {
public:
  RandomAligner() { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomAligner() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual void align(const std::vector<std::string> &source,
                     const std::vector<std::string> &target,
                     std::vector< std::vector<float> > &alignments)
  {
    alignments.resize(source.size());
    for (size_t s = 0; s < source.size(); s++) {
      alignments[s].resize(target.size());
      for (size_t t = 0; t < target.size(); t++) {
        alignments[s][t] = rand() / double(RAND_MAX);
      }
    }
  }

};

class RandomAlignerFactory: public IAlignmentFactory {
public:
  RandomAlignerFactory() { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~RandomAlignerFactory() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

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

  virtual IAlignmentEngine *createInstance(const std::string &specialization_id = "") {
    return new RandomAligner();
  }
};


EXPORT_CASMACAT_PLUGIN(IAlignmentEngine, RandomAlignerFactory);

