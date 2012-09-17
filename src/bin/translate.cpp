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
#include <casmacat/IMtEngine.h>
#include <casmacat/Plugin.h>
#include <iostream>
#include <iterator>
#include <fstream>
#include <cassert>

using namespace casmacat;
using namespace std;

int main(int argc, char* argv[]) {

    if (argc != 3) {
      cerr << "Usage: " << argv[0] << " config.js test\n";
      return EXIT_FAILURE;
    }

    string mt_plugin_fn = "";
    string args = "";

    Plugin<IMtEngine> mt_plugin(mt_plugin_fn, args);

    IMtEngine *mt = mt_plugin.create();
    if (mt == 0) {
      cerr << "Plugin could not be instantiated\n";
    }
    else {
      cerr << "Plugin loaded\n";

      for (int i = 2; i < argc; i++) {
        ifstream file(argv[i]);
        string source;
        vector<string> tok_source, tok_target;

        while(getline(file, source)) {
          tokenize(source, tok_source);

          cout << source << "|||";
          mt->translate(tok_source, tok_target);
          copy(tok_target.begin(), tok_target.end(), ostream_iterator<string>(cout, " "));
          cout << "\n";
          mt->update(tok_source, tok_target);
        }
      }
    }


    return EXIT_SUCCESS;
}


