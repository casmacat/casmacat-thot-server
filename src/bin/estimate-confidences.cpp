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
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <fstream>
#include <cassert>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {

    if (argc != 4) {
      cerr << "Usage: " << argv[0] << " config.js source target\n";
      return EXIT_FAILURE;
    }

    string confidence_estimator_plugin_fn = "";
    string args = "";

    Plugin<IConfidenceEngine> confidence_estimator_plugin(confidence_estimator_plugin_fn, args);

    IConfidenceEngine *confidence_estimator = confidence_estimator_plugin.create();
    if (confidence_estimator == 0) {
      cerr << "Plugin could not be instantiated\n";
    }
    else {
      cerr << "Plugin loaded\n";
      ifstream source_file(argv[2]);
      ifstream target_file(argv[3]);
      string source, target;
      vector<string> tok_source, tok_target;
      std::vector<bool> validated;

      float sentence_confidence;
      std::vector<float> confidences;

      cout.setf(ios::fixed, ios::floatfield);
      cout.precision(2);

      while(getline(source_file, source) and getline(target_file, target)) {
        cout << "source: " << source << "\n";

        tokenize(source, tok_source);
        tokenize(target, tok_target);

        sentence_confidence = confidence_estimator->getSentenceConfidence(tok_source, tok_target, validated);
        confidence_estimator->getWordConfidences(tok_source, tok_target, validated, confidences);

        cout << sentence_confidence;
        for (size_t t = 0; t < confidences.size(); t++) {
          cout << " " << tok_target[t] << "(" << confidences[t] << ")";
        }
        cout << "\n";
      }
    }


    return EXIT_SUCCESS;
}


