/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * translate.cpp
 *
 *  Created on: 21/06/2012
 *      Author: valabau
 */



#include <cstdlib>
#include <casmacat/compat.h>
#include <casmacat/utils.h>
#include <casmacat/IAlignmentEngine.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <fstream>
#include <cassert>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {

    if (argc != 4) {
      cerr << "Usage: " << argv[0] << " aligner.so source target\n";
      return EXIT_FAILURE;
    }

    string aligner_plugin_fn = argv[1];
    string args = "";

    Plugin<IAlignmentFactory> aligner_plugin(aligner_plugin_fn, args);
    IAlignmentFactory *aligner_factory = aligner_plugin.create();
    std::cerr << "who am I? " << typeid(aligner_factory).name() << "\n";
    std::cerr << "who am *I? " << typeid(*aligner_factory).name() << "\n";
    IAlignmentEngine *aligner = aligner_factory->createEngine();
    std::cerr << "who am I? " << typeid(aligner).name() << "\n";
    std::cerr << "who am *I? " << typeid(*aligner).name() << "\n";

    //std::cerr << "Is correct type? " << (aligner->getType() == typeid(IAlignmentEngine)) << "\n";

    if (aligner == 0) {
      cerr << "Plugin could not be instantiated\n";
    }
    else {
      cerr << "Plugin loaded\n";
      ifstream source_file(argv[2]);
      ifstream target_file(argv[3]);
      string source, target;
      vector<string> tok_source, tok_target;
      vector< vector<float> > alignments;

      cout.setf(ios::fixed, ios::floatfield);
      cout.precision(2);

      while(getline(source_file, source) and getline(target_file, target)) {
        cout << "source: " << source << "\n";
        cout << "target: " << target << "\n";

        tokenize(source, tok_source);
        tokenize(target, tok_target);
        aligner->align(tok_source, tok_target, alignments);

        for (size_t s = 0; s < alignments.size(); s++) {
          for (size_t t = 0; t < alignments[s].size(); t++) {
            cout << alignments[s][t] << " ";
          }
          cout << "\n";
        }
      }
    }

    delete aligner;
    delete aligner_factory;


    return EXIT_SUCCESS;
}


