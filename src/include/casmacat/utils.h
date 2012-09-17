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
 * utils.h
 *
 *  Created on: 21/06/2012
 *      Author: valabau
 */

#ifndef CasMaCat_UTILS_H_
#define CasMaCat_UTILS_H_

#include <jsoncpp/json.h>

namespace casmacat {

  void execute_script(const Json::Value &input, Json::Value &output);

  template <typename T>
  void tokenize(const T& str,
                std::vector<T>& tokens,
                const T& delimiters = T(" "))
  {
    if (delimiters == T("")) {
      tokens.reserve(str.size());
      for (typename T::const_iterator it = str.begin(); it != str.end(); ++it) {
        T tok;
        tok.push_back(*it);
        tokens.push_back(tok);
      }
    }
    else {
      tokens.clear();

      // Skip delimiters at beginning.
      typename T::size_type lastPos = str.find_first_not_of(delimiters, 0);
      // Find first "non-delimiter".
      typename T::size_type pos     = str.find_first_of(delimiters, lastPos);

      while (T::npos != pos || T::npos != lastPos) {
          // Found a token, add it to the vector.
          tokens.push_back(str.substr(lastPos, pos - lastPos));
          // Skip delimiters.  Note the "not_of"
          lastPos = str.find_first_not_of(delimiters, pos);
          // Find next "non-delimiter"
          pos = str.find_first_of(delimiters, lastPos);
      }
    }
  }

}


#endif /* CasMaCat_UTILS_H_ */
