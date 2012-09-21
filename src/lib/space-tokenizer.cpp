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
 * space-tokenizer.cpp
 *
 *  Created on: 14/09/2012
 *      Author: valabau
 */

#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>


#include <casmacat/config.h>
#include <casmacat/ITextProcessor.h>
#include <casmacat/plugin-utils.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;


class SpaceTokenizer: public ITextProcessor {
  string delimiters;
public:
  SpaceTokenizer(): delimiters(" ") { }
  SpaceTokenizer(const string &_delimiters): delimiters(_delimiters) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~SpaceTokenizer() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual void preprocess(const std::string &detokenized,
                          std::vector<std::string> &tokenized)
  {
    tokenized.clear();
    tokenize(detokenized, tokenized, delimiters);
  }
  virtual void postprocess(const std::vector<std::string> &tokenized,
                            std::string &detokenized,
                            std::vector< std::pair<size_t, size_t> > &segmentation)
  {
    segmentation.resize(tokenized.size());

    stringstream ss;
    size_t pos = 0;
    for (size_t i = 0; i < tokenized.size(); i++) {
      segmentation[i].first = pos;
      ss << tokenized[i];
      pos = ss.str().size();
      segmentation[i].second = pos;
      if (i + 1 != tokenized.size()) {
        ss << " ";
        pos++;
      }
    }
    detokenized = ss.str();
  }


};

class SpaceTokenizerFactory: public ITextProcessorFactory {
  string delimiters;
public:
  SpaceTokenizerFactory(): delimiters(" ") { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~SpaceTokenizerFactory() { cerr << "I, " << typeid(*this).name() <<  ", am free!!!" << endl; };

  virtual int init(int argc, char *argv[]) {
    // invalid number of arguments
    if (argc > 2) { return EXIT_FAILURE; }
    if (argc == 2) { delimiters = argv[1]; }
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return PACKAGE_VERSION; }

  virtual ITextProcessor *createInstance(const std::string &specialization_id = "") {
    return new SpaceTokenizer(delimiters);
  }
};

EXPORT_CASMACAT_PLUGIN(ITextProcessor, SpaceTokenizerFactory);
