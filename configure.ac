dnl Process this file with autoconf to produce a configure script.

AC_PREREQ(2.59)
AC_INIT(Casmacat Server Library, 0.1, valabau@gmail.com)
AC_CONFIG_SRCDIR([src/include/casmacat/compat.h])
AC_CONFIG_AUX_DIR([build-aux])
AC_CONFIG_HEADER([src/include/casmacat/config.h])
AC_CONFIG_MACRO_DIR([m4])

AC_CANONICAL_SYSTEM

dnl Initialize automake
AM_INIT_AUTOMAKE(casmacat, 0.1)

dnl Initialize Libtool
LT_INIT
LTDL_INIT


YACC=bison
# Checks for programs.
#AC_DISABLE_STATIC
dnl Check if Libtool is present
dnl Libtool is used for building share libraries 
AC_PROG_LIBTOOL
AC_PROG_CXX
AC_LANG(C++)
AC_PROG_INSTALL
AC_PROG_MAKE_SET
#AC_PROG_YACC
#AM_PROG_LEX


# boost
AX_BOOST_BASE(1.41)
AX_BOOST_UNIT_TEST_FRAMEWORK
AM_CONDITIONAL([MAKE_TEST], [test x"$BOOST_UNIT_TEST_FRAMEWORK_LIB" != x])
#AX_BOOST_IOSTREAMS # BOOST_IOSTREAMS_LIB


# doxygen
DX_HTML_FEATURE(ON)
DX_CHM_FEATURE(OFF)
DX_CHI_FEATURE(OFF)
DX_MAN_FEATURE(OFF)
DX_RTF_FEATURE(OFF)
DX_XML_FEATURE(OFF)
DX_PDF_FEATURE(OFF)
DX_PS_FEATURE(OFF)
DX_INIT_DOXYGEN(casmacat, doxygen.cfg, doc)


# optional configure options
AC_ARG_WITH(debug, AC_HELP_STRING(--with-debug, \
[enable debug]), \
[ DEBUG=true \
CXXFLAGS="-g3 -O0"])

AC_ARG_WITH(gprof, AC_HELP_STRING(--with-gprof, \
[enable profiler]), \
[ PROFILE=true \
CPPFLAGS="-DDEBUG=1" \
CXXFLAGS+=" -pg"])



# Checks for libraries.
AM_PROG_LIBTOOL

dnl this allows us specify individual liking flags for each target
AM_PROG_CC_C_O 

# Checks for header files.
AC_HEADER_STDC
AC_CHECK_HEADERS([string])

# Checks for typedefs, structures, and compiler characteristics.
AC_TYPE_SIZE_T

#COMPILANCE_CXXFLAGS="${CPPCXXFLAGS} -D_POSIX_C_SOURCE=200809L"
AX_CHECK_COMPILER_FLAGS([-pedantic], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -pedantic"])
#AX_CHECK_COMPILER_FLAGS([-fpermissive], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -fpermissive"])
AX_CHECK_COMPILER_FLAGS([-Wall], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wall"])
AX_CHECK_COMPILER_FLAGS([-Wextra], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wextra"])
AX_CHECK_COMPILER_FLAGS([-Wshadow], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wshadow"])
# enable this on profiling since it will show which inlines where not made
#AX_CHECK_COMPILER_FLAGS([-Winline], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Winline"])
AX_CHECK_COMPILER_FLAGS([-Wunused], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused"])
AX_CHECK_COMPILER_FLAGS([-Wunused-variable], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-variable"])
AX_CHECK_COMPILER_FLAGS([-Wunused-parameter], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-parameter"])
AX_CHECK_COMPILER_FLAGS([-Wunused-function], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -Wunused-function"])

AS_IF(test x"$DEBUG" = x"true" -o "$PROFILE" = x"true" , [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -DDEBUG -DLT_DEBUG_LOADERS"], [WARNING_CXXFLAGS="${WARNING_CXXFLAGS} -DNDEBUG"])
#AS_IF(test x"$DEBUG" = x"true", [OPTIMIZATION_CXXFLAGS="${OPTIMIZATION_CXXFLAGS} -DDEBUG -g3 -O0"], [OPTIMIZATION_CXXFLAGS="${OPTIMIZATION_CXXFLAGS} -O2 -ffast-math"])



AC_SUBST([WARNING_CXXFLAGS], ["${WARNING_CXXFLAGS}"])
AC_SUBST([COMPILANCE_CXXFLAGS])
AC_SUBST([OPTIMIZATION_CXXFLAGS])


AC_CONFIG_FILES(Makefile
                src/bin/Makefile
                src/lib/Makefile
                src/include/casmacat/Makefile)
AC_OUTPUT